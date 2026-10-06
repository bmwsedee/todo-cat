// @vitest-environment node
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { signUp } from "@/test/sign-up";
import { stubTempDatabase } from "@/test/temp-database";

// `server-only` throws outside a React Server Components bundle, which Vitest is not.
vi.mock("server-only", () => ({}));

// Server Actions read the request through `headers()` and refresh through `refresh()`, which
// only work inside a Next request; these stand in for them.
const request = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => request.headers }));
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/cache", () => ({ refresh }));

const removeTempDatabase = stubTempDatabase();
vi.stubEnv("BETTER_AUTH_SECRET", "vitest-secret-that-is-at-least-32-chars");
vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
const { db } = await import("@/lib/db");
const { addTodo, listTodos } = await import("@/lib/todo-service");
const { getUserId } = await import("@/lib/session");
const { addTodoAction, deleteTodoAction, setTodoDoneAction } = await import(
  "./todo-actions"
);

beforeAll(() => migrate(db, { migrationsFolder: "drizzle" }));
afterAll(() => removeTempDatabase(db.$client));
beforeEach(() => {
  request.headers = new Headers();
  refresh.mockClear();
});

/** Signs a fresh user in for the actions that follow, and returns their id. */
async function signInAs(name: string) {
  const token = await signUp(name);
  request.headers = new Headers({ authorization: `Bearer ${token}` });
  return (await getUserId(request.headers)) as string;
}

test("each action answers unauthorized without a session and refreshes nothing", async () => {
  const id = crypto.randomUUID();
  expect(await addTodoAction({ title: "Nap" })).toEqual({
    error: "unauthorized",
  });
  expect(await setTodoDoneAction({ id, done: true })).toEqual({
    error: "unauthorized",
  });
  expect(await deleteTodoAction({ id })).toEqual({ error: "unauthorized" });
  expect(refresh).not.toHaveBeenCalled();
});

test("adds, checks off, reopens and deletes the user's own todo", async () => {
  const userId = await signInAs("Ada");

  expect(
    await addTodoAction({ title: " Buy tuna ", dueDate: "2026-10-12" }),
  ).toEqual({ error: null });
  const [todo] = await listTodos(userId);
  expect(todo).toMatchObject({ title: "Buy tuna", dueDate: "2026-10-12" });

  expect(await setTodoDoneAction({ id: todo.id, done: true })).toEqual({
    error: null,
  });
  expect((await listTodos(userId))[0].done).toBe(true);
  expect(await setTodoDoneAction({ id: todo.id, done: false })).toEqual({
    error: null,
  });
  expect((await listTodos(userId))[0].done).toBe(false);

  expect(await deleteTodoAction({ id: todo.id })).toEqual({ error: null });
  expect(await listTodos(userId)).toEqual([]);
  expect(refresh).toHaveBeenCalledTimes(4);
});

test("another user's todo is not found and stays as it was", async () => {
  const theirs = await signInAs("Other");
  const { id } = await addTodo(theirs, { title: "Theirs" });
  await signInAs("Me");

  expect(await setTodoDoneAction({ id, done: true })).toEqual({
    error: "todo-not-found",
  });
  expect(await deleteTodoAction({ id })).toEqual({ error: "todo-not-found" });
  expect(await listTodos(theirs)).toMatchObject([
    { id, title: "Theirs", done: false },
  ]);
});

test("input that breaks the contract is validation-failed", async () => {
  const userId = await signInAs("Ada");
  const { id } = await addTodo(userId, { title: "Nap" });

  for (const result of [
    await addTodoAction({ title: "   " }),
    await addTodoAction({ title: "Vet", dueDate: "2026-02-29" }),
    await addTodoAction({ title: "Nap", userId: "someone-else" }),
    await addTodoAction("Nap"),
    await setTodoDoneAction({ id, done: "yes" }),
    await setTodoDoneAction({ id, done: true, title: "Renamed" }),
    await deleteTodoAction({ id: "" }),
  ]) {
    expect(result).toEqual({ error: "validation-failed" });
  }
  expect(await listTodos(userId)).toMatchObject([
    { id, title: "Nap", done: false },
  ]);
});
