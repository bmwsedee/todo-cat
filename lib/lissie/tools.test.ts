// @vitest-environment node
import { RequestContext } from "@mastra/core/request-context";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { stubTempDatabase } from "@/test/temp-database";

// `server-only` throws outside a React Server Components bundle, which Vitest is not.
vi.mock("server-only", () => ({}));

const removeTempDatabase = stubTempDatabase();
const { db } = await import("@/lib/db");
const { user } = await import("@/lib/schema");
const { addTodo, listTodos } = await import("@/lib/todo-service");
const { addTodoTool, listTodosTool, lissieRequestContext, setTodoDoneTool } =
  await import("@/lib/lissie/tools");

beforeAll(() => migrate(db, { migrationsFolder: "drizzle" }));
afterAll(() => removeTempDatabase(db.$client));

// Two fresh users per test: `me` is the session user, `other` owns todos `me` must never reach.
async function twoUsers() {
  const [me, other] = [crypto.randomUUID(), crypto.randomUUID()];
  await db.insert(user).values([
    { id: me, name: "Me", email: `${me}@example.com` },
    { id: other, name: "Other", email: `${other}@example.com` },
  ]);
  return { me, other, asMe: lissieRequestContext(me) };
}

type LissieTool =
  | typeof addTodoTool
  | typeof listTodosTool
  | typeof setTodoDoneTool;

/**
 * Runs a tool's executor the way the agent does, with the run's request context. The input
 * is `unknown` because these tests also send what the model might, valid or not.
 */
function run(
  tool: LissieTool,
  input: unknown,
  requestContext?: RequestContext,
) {
  if (!tool.execute) throw new Error(`${tool.id} has no executor`);
  // Mastra fills in the rest of the execution context (tracing, abort signal) itself.
  const execute = tool.execute as (
    input: unknown,
    context: { requestContext?: RequestContext },
  ) => Promise<unknown>;
  return execute(input, { requestContext });
}

/** Mastra reports a rejected input or request context as a result, not a throw. */
const rejected = { error: true, message: expect.any(String) };

describe("addTodo", () => {
  test("adds the todo to the session user's list only", async () => {
    const { me, other, asMe } = await twoUsers();

    const todo = await run(
      addTodoTool,
      { title: "Buy milk", dueDate: "2026-10-07" },
      asMe,
    );

    expect(todo).toMatchObject({
      title: "Buy milk",
      dueDate: "2026-10-07",
      done: false,
    });
    expect(await listTodos(me)).toEqual([todo]);
    expect(await listTodos(other)).toEqual([]);
  });

  test("rejects a user id the model makes up", async () => {
    const { me, other, asMe } = await twoUsers();

    const result = await run(
      addTodoTool,
      // The model fills in the arguments; the strict schema has no room for an owner.
      { title: "Theirs now", userId: other },
      asMe,
    );

    expect(result).toMatchObject(rejected);
    expect(await listTodos(other)).toEqual([]);
    expect(await listTodos(me)).toEqual([]);
  });

  test("rejects a blank title", async () => {
    const { me, asMe } = await twoUsers();

    expect(await run(addTodoTool, { title: "  " }, asMe)).toMatchObject(
      rejected,
    );
    expect(await listTodos(me)).toEqual([]);
  });
});

describe("listTodos", () => {
  test("lists the session user's todos and never another user's", async () => {
    const { me, other, asMe } = await twoUsers();
    const mine = await addTodo(me, { title: "Feed the cat" });
    await addTodo(other, { title: "Their secret" });

    expect(await run(listTodosTool, {}, asMe)).toEqual({ todos: [mine] });
  });

  test("filters by status and text", async () => {
    const { me, asMe } = await twoUsers();
    const milk = await addTodo(me, { title: "Buy milk" });
    await addTodo(me, { title: "Brush the cat" });
    await run(setTodoDoneTool, { id: milk.id, done: true }, asMe);

    const done = await run(listTodosTool, { status: "done" }, asMe);
    expect(done).toMatchObject({ todos: [{ title: "Buy milk" }] });
    const cat = await run(listTodosTool, { text: "CAT" }, asMe);
    expect(cat).toMatchObject({ todos: [{ title: "Brush the cat" }] });
  });
});

describe("setTodoDone", () => {
  test("marks the session user's todo done and opens it again", async () => {
    const { me, asMe } = await twoUsers();
    const todo = await addTodo(me, { title: "Feed the cat" });

    const done = await run(setTodoDoneTool, { id: todo.id, done: true }, asMe);
    expect(done).toMatchObject({
      id: todo.id,
      done: true,
      completedAt: expect.any(String),
    });

    const reopened = await run(
      setTodoDoneTool,
      { id: todo.id, done: false },
      asMe,
    );
    expect(reopened).toMatchObject({ done: false, completedAt: null });
  });

  test("reports another user's todo as not found and leaves it alone", async () => {
    const { other, asMe } = await twoUsers();
    const theirs = await addTodo(other, { title: "Their secret" });

    const result = await run(
      setTodoDoneTool,
      { id: theirs.id, done: true },
      asMe,
    );

    expect(result).toEqual({
      error: {
        code: "todo-not-found",
        message: `No todo with id ${theirs.id}`,
      },
    });
    expect(await listTodos(other)).toEqual([theirs]);
  });
});

describe("without the session user in the request context", () => {
  test.each([
    ["no request context", undefined],
    ["an empty request context", new RequestContext()],
  ])("every tool refuses with %s", async (_, context) => {
    const { other } = await twoUsers();
    const theirs = await addTodo(other, { title: "Their secret" });

    expect(await run(listTodosTool, {}, context)).toMatchObject(rejected);
    expect(await run(addTodoTool, { title: "Nap" }, context)).toMatchObject(
      rejected,
    );
    expect(
      await run(setTodoDoneTool, { id: theirs.id, done: true }, context),
    ).toMatchObject(rejected);
    expect(await listTodos(other)).toEqual([theirs]);
  });
});
