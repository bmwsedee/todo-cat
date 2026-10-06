// @vitest-environment node
import { A2uiMessageListSchema, MessageProcessor } from "@a2ui/web_core/v0_9";
import { tryParseA2UIOperations } from "@ag-ui/a2ui-middleware";
import { RequestContext } from "@mastra/core/request-context";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { todoCatCatalog } from "@/components/a2ui-catalog";
import { PROGRESS_SURFACE_ID } from "@/lib/lissie/progress-card";
import { stubTempDatabase } from "@/test/temp-database";

// `server-only` throws outside a React Server Components bundle, which Vitest is not.
vi.mock("server-only", () => ({}));

const removeTempDatabase = stubTempDatabase();
const { db } = await import("@/lib/db");
const { todos, user } = await import("@/lib/schema");
const { addTodo, listTodos, updateTodo } = await import("@/lib/todo-service");
const {
  addTodoTool,
  listTodosTool,
  lissieRequestContext,
  setTodoDoneTool,
  showProgressTool,
} = await import("@/lib/lissie/tools");

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
  | typeof setTodoDoneTool
  | typeof showProgressTool;

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

describe("showProgress", () => {
  /** Adds `open` open and `done` done todos to the user's list. */
  async function fill(userId: string, open: number, done: number) {
    for (let i = 0; i < open + done; i++) {
      const todo = await addTodo(userId, { title: `Chore ${i}` });
      if (i >= open) await updateTodo(userId, todo.id, { done: true });
    }
  }

  /** The A2UI operations in a result, as the A2UI middleware finds them in a tool result. */
  function operationsIn(result: unknown) {
    const parsed = tryParseA2UIOperations(JSON.stringify(result));
    if (!parsed) throw new Error("no A2UI operations in the result");
    return parsed.operations;
  }

  test("returns well-formed A2UI with the counts of the session user's rows", async () => {
    const { me, other, asMe } = await twoUsers();
    await fill(me, 2, 3);
    await fill(other, 4, 0);

    const operations = A2uiMessageListSchema.parse(
      operationsIn(await run(showProgressTool, {}, asMe)),
    );

    // The chat's catalog takes the surface, and every component is one it has, with props
    // its schema accepts.
    const processor = new MessageProcessor([todoCatCatalog]);
    processor.processMessages(operations);
    const surface = processor.model.getSurface(PROGRESS_SURFACE_ID);
    if (!surface) throw new Error("no surface was created");
    const components = [...surface.componentsModel.entries].map(([, c]) => c);
    expect(components.map((c) => c.id)).toContain("root");
    for (const component of components) {
      const api = todoCatCatalog.components.get(component.type);
      expect(api, component.type).toBeDefined();
      expect(() => api?.schema.parse(component.properties)).not.toThrow();
    }

    const rows = await db.select().from(todos).where(eq(todos.ownerId, me));
    const done = rows.filter((row) => row.done).length;
    expect(surface.dataModel.get("/")).toEqual({
      total: rows.length,
      done,
      open: rows.length - done,
    });
    expect(surface.dataModel.get("/")).toEqual({ total: 5, done: 3, open: 2 });
  });

  test("binds the numbers through the data model, never into the tree", async () => {
    const [a, b] = [await twoUsers(), await twoUsers()];
    await fill(a.me, 1, 0);
    await fill(b.me, 0, 7);

    const components = async (asMe: RequestContext) =>
      operationsIn(await run(showProgressTool, {}, asMe)).find(
        (operation) => "updateComponents" in operation,
      );
    expect(await components(a.asMe)).toEqual(await components(b.asMe));
  });

  test("counts an empty list as nothing at all", async () => {
    const { asMe } = await twoUsers();

    const data = operationsIn(await run(showProgressTool, {}, asMe)).find(
      (operation) => "updateDataModel" in operation,
    );
    expect(data).toMatchObject({
      updateDataModel: { path: "/", value: { total: 0, done: 0, open: 0 } },
    });
  });

  test("takes no input, so the model cannot supply numbers or a user", async () => {
    const { other, asMe } = await twoUsers();

    expect(
      await run(showProgressTool, { done: 99, userId: other }, asMe),
    ).toMatchObject(rejected);
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
    expect(await run(showProgressTool, {}, context)).toMatchObject(rejected);
    expect(await listTodos(other)).toEqual([theirs]);
  });
});
