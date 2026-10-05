// @vitest-environment node
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { stubTempDatabase } from "@/test/temp-database";

// `server-only` throws outside a React Server Components bundle, which Vitest is not.
vi.mock("server-only", () => ({}));

const removeTempDatabase = stubTempDatabase();
const { db } = await import("@/lib/db");
const { user } = await import("@/lib/schema");
const { addTodo, deleteTodo, getTodo, listTodos, updateTodo } = await import(
  "@/lib/todo-service"
);

beforeAll(() => migrate(db, { migrationsFolder: "drizzle" }));
afterAll(() => removeTempDatabase(db.$client));

// Two fresh users per test: `me` acts, `other` owns todos that `me` must never reach.
async function twoUsers() {
  const [me, other] = [crypto.randomUUID(), crypto.randomUUID()];
  await db.insert(user).values([
    { id: me, name: "Me", email: `${me}@example.com` },
    { id: other, name: "Other", email: `${other}@example.com` },
  ]);
  return { me, other };
}

const notFound = { code: "todo-not-found" };

describe("addTodo", () => {
  test("returns the new open todo as a contract object", async () => {
    const { me } = await twoUsers();
    const now = new Date("2026-10-01T09:30:00.000Z");

    const todo = await addTodo(
      me,
      { title: "Buy tuna", dueDate: "2026-10-12" },
      now,
    );

    expect(todo).toEqual({
      id: expect.any(String),
      title: "Buy tuna",
      dueDate: "2026-10-12",
      done: false,
      createdAt: "2026-10-01T09:30:00.000Z",
      completedAt: null,
    });
  });

  test("leaves the due date empty when none is given", async () => {
    const { me } = await twoUsers();

    expect((await addTodo(me, { title: "Nap" })).dueDate).toBeNull();
  });

  test("adds the todo to the caller's list only", async () => {
    const { me, other } = await twoUsers();

    const todo = await addTodo(me, { title: "Mine" });

    expect(await listTodos(me)).toEqual([todo]);
    expect(await listTodos(other)).toEqual([]);
  });
});

describe("getTodo", () => {
  test("returns the caller's todo", async () => {
    const { me } = await twoUsers();
    const todo = await addTodo(me, { title: "Mine" });

    expect(await getTodo(me, todo.id)).toEqual(todo);
  });

  test("reports another user's todo as not found", async () => {
    const { me, other } = await twoUsers();
    const theirs = await addTodo(other, { title: "Theirs" });

    await expect(getTodo(me, theirs.id)).rejects.toMatchObject(notFound);
  });

  test("reports an unknown id as not found", async () => {
    const { me } = await twoUsers();

    await expect(getTodo(me, "no-such-id")).rejects.toMatchObject(notFound);
  });
});

describe("listTodos", () => {
  test("never includes another user's todos, whatever the filter", async () => {
    const { me, other } = await twoUsers();
    const theirs = await addTodo(other, { title: "Shared word" });
    await updateTodo(other, theirs.id, { done: true });
    await addTodo(other, { title: "Shared word too" });

    for (const status of ["open", "done", "all"] as const) {
      expect(await listTodos(me, { status })).toEqual([]);
      expect(await listTodos(me, { status, text: "shared" })).toEqual([]);
    }
  });

  test("filters by status, and lists everything without one", async () => {
    const { me } = await twoUsers();
    const open = await addTodo(me, { title: "Open" });
    const done = await updateTodo(
      me,
      (await addTodo(me, { title: "Done" })).id,
      { done: true },
    );

    expect(await listTodos(me, { status: "open" })).toEqual([open]);
    expect(await listTodos(me, { status: "done" })).toEqual([done]);
    expect(await listTodos(me, { status: "all" })).toEqual([open, done]);
    expect(await listTodos(me)).toEqual([open, done]);
  });

  test("filters by text, case-insensitively and literally", async () => {
    const { me } = await twoUsers();
    const tuna = await addTodo(me, { title: "Buy TUNA" });
    const percent = await addTodo(me, { title: "Ask for 100% attention" });
    await addTodo(me, { title: "Nap" });

    expect(await listTodos(me, { text: "tuna" })).toEqual([tuna]);
    expect(await listTodos(me, { text: "0%" })).toEqual([percent]);
    expect(await listTodos(me, { text: "_" })).toEqual([]);
  });

  test("orders open first, then by due date with none last, then oldest first", async () => {
    const { me } = await twoUsers();
    const day = (n: number) => new Date(Date.UTC(2026, 8, n));
    const undated = await addTodo(me, { title: "Undated" }, day(1));
    const later = await addTodo(
      me,
      { title: "Later", dueDate: "2026-10-20" },
      day(2),
    );
    const sooner = await addTodo(
      me,
      { title: "Sooner", dueDate: "2026-10-10" },
      day(3),
    );
    const newerUndated = await addTodo(me, { title: "Newer" }, day(4));
    const done = await updateTodo(
      me,
      (await addTodo(me, { title: "Done", dueDate: "2026-01-01" }, day(5))).id,
      { done: true },
    );

    expect((await listTodos(me)).map((t) => t.title)).toEqual(
      [sooner, later, undated, newerUndated, done].map((t) => t.title),
    );
  });
});

describe("updateTodo", () => {
  test("changes only the fields present", async () => {
    const { me } = await twoUsers();
    const todo = await addTodo(me, { title: "Old", dueDate: "2026-10-12" });

    const renamed = await updateTodo(me, todo.id, { title: "New" });
    expect(renamed).toEqual({ ...todo, title: "New" });

    const moved = await updateTodo(me, todo.id, { dueDate: "2026-11-01" });
    expect(moved).toEqual({ ...renamed, dueDate: "2026-11-01" });

    const cleared = await updateTodo(me, todo.id, { dueDate: null });
    expect(cleared).toEqual({ ...moved, dueDate: null });

    expect(await updateTodo(me, todo.id, {})).toEqual(cleared);
    expect(await getTodo(me, todo.id)).toEqual(cleared);
  });

  test("sets completedAt when marked done and clears it when reopened", async () => {
    const { me } = await twoUsers();
    const todo = await addTodo(me, { title: "Groom" });
    const doneAt = new Date("2026-10-02T08:00:00.000Z");

    const done = await updateTodo(me, todo.id, { done: true }, doneAt);
    expect(done).toMatchObject({
      done: true,
      completedAt: doneAt.toISOString(),
    });

    const again = await updateTodo(
      me,
      todo.id,
      { done: true },
      new Date("2026-10-03T08:00:00.000Z"),
    );
    expect(again.completedAt).toBe(doneAt.toISOString());

    const reopened = await updateTodo(me, todo.id, { done: false });
    expect(reopened).toMatchObject({ done: false, completedAt: null });
  });

  test("reports another user's todo as not found and leaves it unchanged", async () => {
    const { me, other } = await twoUsers();
    const theirs = await addTodo(other, { title: "Theirs" });

    await expect(
      updateTodo(me, theirs.id, { title: "Hijacked", done: true }),
    ).rejects.toMatchObject(notFound);
    await expect(updateTodo(me, theirs.id, {})).rejects.toMatchObject(notFound);
    expect(await getTodo(other, theirs.id)).toEqual(theirs);
  });

  test("reports an unknown id as not found", async () => {
    const { me } = await twoUsers();

    await expect(
      updateTodo(me, "no-such-id", { title: "x" }),
    ).rejects.toMatchObject(notFound);
  });
});

describe("deleteTodo", () => {
  test("removes the caller's todo", async () => {
    const { me } = await twoUsers();
    const todo = await addTodo(me, { title: "Mine" });

    await deleteTodo(me, todo.id);

    await expect(getTodo(me, todo.id)).rejects.toMatchObject(notFound);
    expect(await listTodos(me)).toEqual([]);
  });

  test("reports another user's todo as not found and keeps it", async () => {
    const { me, other } = await twoUsers();
    const theirs = await addTodo(other, { title: "Theirs" });

    await expect(deleteTodo(me, theirs.id)).rejects.toMatchObject(notFound);
    expect(await getTodo(other, theirs.id)).toEqual(theirs);
  });

  test("reports a todo deleted twice as not found", async () => {
    const { me } = await twoUsers();
    const todo = await addTodo(me, { title: "Mine" });
    await deleteTodo(me, todo.id);

    await expect(deleteTodo(me, todo.id)).rejects.toMatchObject(notFound);
  });
});

test("deleting a user deletes their todos and nobody else's", async () => {
  const { me, other } = await twoUsers();
  const mine = await addTodo(me, { title: "Mine" });
  const theirs = await addTodo(other, { title: "Theirs" });

  await db.delete(user).where(eq(user.id, me));

  await expect(getTodo(me, mine.id)).rejects.toMatchObject(notFound);
  expect(await listTodos(other)).toEqual([theirs]);
});
