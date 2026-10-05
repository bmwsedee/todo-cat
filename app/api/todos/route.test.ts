// @vitest-environment node
import {
  errorBodySchema,
  todoListSchema,
  todoSchema,
} from "@todo-cat/contract";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { stubTempDatabase } from "@/test/temp-database";

// `server-only` throws outside a React Server Components bundle, which Vitest is not.
vi.mock("server-only", () => ({}));

const removeTempDatabase = stubTempDatabase();
vi.stubEnv("BETTER_AUTH_SECRET", "vitest-secret-that-is-at-least-32-chars");
vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
const { db } = await import("@/lib/db");
const authRoute = await import("@/app/api/auth/[...all]/route");
const todosRoute = await import("./route");
const todoRoute = await import("./[id]/route");

beforeAll(() => migrate(db, { migrationsFolder: "drizzle" }));
afterAll(() => removeTempDatabase(db.$client));

const base = "http://localhost:3000";

/** Signs up through the real auth endpoint and returns the session token it hands out. */
async function signUp(name: string) {
  const response = await authRoute.POST(
    new Request(`${base}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        email: `${crypto.randomUUID()}@example.com`,
        password: "correct horse battery",
      }),
    }),
  );
  expect(response.status).toBe(200);
  const token = response.headers.get("set-auth-token");
  expect(token).toBeTruthy();
  return token as string;
}

type Call = { token?: string; body?: string; query?: string };

function request(method: string, path: string, call: Call = {}) {
  const headers = new Headers();
  if (call.token) headers.set("authorization", `Bearer ${call.token}`);
  if (call.body !== undefined) headers.set("content-type", "application/json");
  return new Request(`${base}${path}${call.query ?? ""}`, {
    method,
    headers,
    body: call.body,
  });
}

const json = (value: unknown) => JSON.stringify(value);

// The REST client's view of the API: one function per endpoint, as the CLI will have.
const api = {
  list: (call?: Call) => todosRoute.GET(request("GET", "/api/todos", call)),
  add: (call?: Call) => todosRoute.POST(request("POST", "/api/todos", call)),
  get: (id: string, call?: Call) =>
    todoRoute.GET(request("GET", `/api/todos/${id}`, call), params(id)),
  update: (id: string, call?: Call) =>
    todoRoute.PATCH(request("PATCH", `/api/todos/${id}`, call), params(id)),
  remove: (id: string, call?: Call) =>
    todoRoute.DELETE(request("DELETE", `/api/todos/${id}`, call), params(id)),
};

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function expectError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(errorBodySchema.parse(await response.json()).error.code).toBe(code);
}

describe("without a valid bearer token", () => {
  const someId = crypto.randomUUID();
  const endpoints = [
    ["GET /api/todos", (call: Call) => api.list(call)],
    [
      "POST /api/todos",
      (call: Call) => api.add({ ...call, body: json({ title: "Nap" }) }),
    ],
    ["GET /api/todos/{id}", (call: Call) => api.get(someId, call)],
    [
      "PATCH /api/todos/{id}",
      (call: Call) =>
        api.update(someId, { ...call, body: json({ done: true }) }),
    ],
    ["DELETE /api/todos/{id}", (call: Call) => api.remove(someId, call)],
  ] as const;

  test.each(endpoints)("%s answers 401 without a token", async (_, call) => {
    await expectError(await call({}), 401, "unauthorized");
  });

  test.each(endpoints)(
    "%s answers 401 with an invalid token",
    async (_, call) => {
      await expectError(
        await call({ token: "not-a-session" }),
        401,
        "unauthorized",
      );
    },
  );
});

test("adds, lists, marks done, filters and deletes a todo", async () => {
  const token = await signUp("Ada");

  const added = await api.add({
    token,
    body: json({ title: "  Buy tuna ", dueDate: "2026-10-12" }),
  });
  expect(added.status).toBe(201);
  const todo = todoSchema.parse(await added.json());
  expect(todo).toMatchObject({
    title: "Buy tuna",
    dueDate: "2026-10-12",
    done: false,
  });

  const listed = await api.list({ token });
  expect(listed.status).toBe(200);
  expect(todoListSchema.parse(await listed.json())).toEqual([todo]);

  const updated = await api.update(todo.id, {
    token,
    body: json({ done: true }),
  });
  expect(updated.status).toBe(200);
  const done = todoSchema.parse(await updated.json());
  expect(done).toMatchObject({ id: todo.id, done: true });
  expect(done.completedAt).not.toBeNull();

  const filtered = async (query: string) =>
    todoListSchema.parse(await (await api.list({ token, query })).json());
  expect(await filtered("?status=done&text=TUNA")).toEqual([done]);
  expect(await filtered("?status=open")).toEqual([]);
  expect(await filtered("?text=salmon")).toEqual([]);

  const fetched = await api.get(todo.id, { token });
  expect(todoSchema.parse(await fetched.json())).toEqual(done);

  const deleted = await api.remove(todo.id, { token });
  expect(deleted.status).toBe(204);
  expect(await deleted.text()).toBe("");
  await expectError(await api.get(todo.id, { token }), 404, "todo-not-found");
  expect(
    todoListSchema.parse(await (await api.list({ token })).json()),
  ).toEqual([]);
});

test("answers 404 for another user's todo and leaves it untouched", async () => {
  const [mine, theirs] = await Promise.all([signUp("Me"), signUp("Other")]);
  const added = await api.add({
    token: theirs,
    body: json({ title: "Theirs" }),
  });
  const { id } = todoSchema.parse(await added.json());

  await expectError(await api.get(id, { token: mine }), 404, "todo-not-found");
  await expectError(
    await api.update(id, { token: mine, body: json({ done: true }) }),
    404,
    "todo-not-found",
  );
  await expectError(
    await api.remove(id, { token: mine }),
    404,
    "todo-not-found",
  );
  expect(
    todoListSchema.parse(await (await api.list({ token: mine })).json()),
  ).toEqual([]);

  const kept = todoSchema.parse(
    await (await api.get(id, { token: theirs })).json(),
  );
  expect(kept).toMatchObject({ title: "Theirs", done: false });
});

test("answers 400 validation-failed for invalid input", async () => {
  const token = await signUp("Ada");
  const { id } = todoSchema.parse(
    await (await api.add({ token, body: json({ title: "Nap" }) })).json(),
  );
  const invalid = [
    api.add({ token, body: json({ title: "   " }) }),
    api.add({ token, body: json({ title: "Vet", dueDate: "2026-02-29" }) }),
    api.add({ token, body: "{ not json" }),
    api.add({ token }),
    api.update(id, { token, body: json({ titel: "Typo" }) }),
    api.update(id, { token, body: json({ done: "yes" }) }),
    api.list({ token, query: "?status=later" }),
    api.list({ token, query: "?sort=title" }),
  ];

  for (const response of await Promise.all(invalid)) {
    await expectError(response, 400, "validation-failed");
  }
  const unchanged = todoSchema.parse(
    await (await api.get(id, { token })).json(),
  );
  expect(unchanged).toMatchObject({ title: "Nap", done: false });
});
