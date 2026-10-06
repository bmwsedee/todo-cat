// @vitest-environment node
import { ɵGLOBAL_STORE } from "@copilotkit/runtime/v2";
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { lissieThreadId } from "@/lib/lissie/thread";
import { signUp } from "@/test/sign-up";
import { stubTempDatabase } from "@/test/temp-database";

// `server-only` throws outside a React Server Components bundle, which Vitest is not.
vi.mock("server-only", () => ({}));

// Lissie answers every turn with the same line, without a network call.
const model = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/lissie/model", () => ({
  get lissieModel() {
    return model.current;
  },
}));
const mockModel = new MockLanguageModelV3({
  doStream: async () => ({
    stream: simulateReadableStream({
      chunks: [
        { type: "stream-start", warnings: [] },
        { type: "text-start", id: "t" },
        { type: "text-delta", id: "t", delta: "Fine. I'm listening." },
        { type: "text-end", id: "t" },
        {
          type: "finish",
          finishReason: { unified: "stop", raw: "stop" },
          usage: {
            inputTokens: {
              total: 1,
              noCache: 1,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: { total: 1, text: 1, reasoning: undefined },
          },
        },
      ],
    }),
  }),
});
model.current = mockModel;

const removeTempDatabase = stubTempDatabase();
vi.stubEnv("BETTER_AUTH_SECRET", "vitest-secret-that-is-at-least-32-chars");
vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
const { db } = await import("@/lib/db");
const { GET, POST } = await import("./[[...slug]]/route");
const { mastra } = await import("@/lib/lissie/mastra");

beforeAll(() => migrate(db, { migrationsFolder: "drizzle" }));
afterAll(() => removeTempDatabase(db.$client));

const base = "http://localhost:3000/api/copilotkit";

function call(
  method: "GET" | "POST",
  path: string,
  { token, body }: { token?: string; body?: unknown } = {},
) {
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (body !== undefined) headers.set("content-type", "application/json");
  const request = new Request(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return method === "GET" ? GET(request) : POST(request);
}

function runInput(threadId: string, text = "Remind me to buy tuna.") {
  return {
    threadId,
    runId: crypto.randomUUID(),
    messages: [{ id: crypto.randomUUID(), role: "user", content: text }],
    tools: [],
    context: [],
    state: {},
    forwardedProps: {},
  };
}

/** The AG-UI events of a server-sent event stream. */
async function events(response: Response) {
  const text = await response.text();
  return text
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)) as { type: string } & object);
}

async function storedTexts(threadId: string) {
  const memory = await mastra.getAgent("lissie").getMemory();
  if (!(await memory?.getThreadById({ threadId }))) return [];
  const recalled = await memory?.recall({ threadId, perPage: false });
  return (recalled?.messages ?? []).map((message) =>
    message.content.parts
      .flatMap((part) => (part.type === "text" ? [part.text] : []))
      .join(""),
  );
}

const someThread = lissieThreadId("someone");
// Every route the runtime serves in multi-route mode, plus one it does not.
const routes = [
  ["GET", "/info", undefined],
  ["POST", "/agent/lissie/run", runInput(someThread)],
  ["POST", "/agent/lissie/connect", runInput(someThread)],
  ["POST", `/agent/lissie/stop/${someThread}`, {}],
  ["POST", "/agent/lissie/suggest", runInput(someThread)],
  ["GET", "/threads", undefined],
  ["GET", `/threads/${someThread}/messages`, undefined],
  ["GET", `/threads/${someThread}/events`, undefined],
  ["GET", `/threads/${someThread}/state`, undefined],
  ["POST", "/threads/clear", {}],
  ["POST", "/threads/subscribe", {}],
  ["POST", `/threads/${someThread}/archive`, {}],
  ["POST", "/transcribe", {}],
  ["GET", "/memories", undefined],
  ["GET", "/inspector-metadata", undefined],
  ["GET", "/no-such-route", undefined],
] as const;

describe("without a valid session", () => {
  test.each(routes)(
    "%s %s answers 401 without a token",
    async (method, path, body) => {
      const response = await call(method, path, { body });
      expect(response.status).toBe(401);
    },
  );

  test.each(routes)(
    "%s %s answers 401 with an invalid token",
    async (method, path, body) => {
      const response = await call(method, path, {
        token: "not-a-session",
        body,
      });
      expect(response.status).toBe(401);
    },
  );

  test("never reaches the model", () => {
    expect(mockModel.doStreamCalls).toHaveLength(0);
  });
});

describe("with a session", () => {
  test("serves runtime info with Lissie as the agent", async () => {
    const token = await signUp("Ada");
    const response = await call("GET", "/info", { token });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      agents: { lissie: expect.anything() },
    });
  });

  test("runs Lissie on the caller's thread and stores the turn in their memory", async () => {
    const token = await signUp("Ada");
    const userId = await userIdOf(token);
    const threadId = lissieThreadId(userId);

    const response = await call("POST", "/agent/lissie/run", {
      token,
      body: runInput(threadId),
    });
    expect(response.status).toBe(200);
    const types = (await events(response)).map((event) => event.type);
    expect(types).toContain("TEXT_MESSAGE_CONTENT");
    expect(types.at(-1)).toBe("RUN_FINISHED");

    expect(await storedTexts(threadId)).toEqual([
      "Remind me to buy tuna.",
      "Fine. I'm listening.",
    ]);
    const memory = await mastra.getAgent("lissie").getMemory();
    const thread = await memory?.getThreadById({ threadId });
    expect(thread?.resourceId).toBe(userId);
  });

  test("replays the conversation from memory after a restart", async () => {
    const token = await signUp("Ada");
    const threadId = lissieThreadId(await userIdOf(token));
    const run = await call("POST", "/agent/lissie/run", {
      token,
      body: runInput(threadId, "Add: vet on Friday."),
    });
    await run.text();

    // A restart forgets every run the in-memory runner kept; Mastra memory does not.
    ɵGLOBAL_STORE.clear();
    const response = await call("POST", "/agent/lissie/connect", {
      token,
      body: runInput(threadId),
    });
    expect(response.status).toBe(200);
    const snapshot = (await events(response)).find(
      (event) => event.type === "MESSAGES_SNAPSHOT",
    );
    expect(snapshot).toMatchObject({
      messages: [
        { role: "user", content: "Add: vet on Friday." },
        { role: "assistant", content: "Fine. I'm listening." },
      ],
    });
  });

  test("connecting to a thread with no history replays nothing", async () => {
    const token = await signUp("Ada");
    const threadId = lissieThreadId(await userIdOf(token));
    const response = await call("POST", "/agent/lissie/connect", {
      token,
      body: runInput(threadId),
    });
    expect(response.status).toBe(200);
    expect(
      (await events(response)).find((e) => e.type === "MESSAGES_SNAPSHOT"),
    ).toMatchObject({ messages: [] });
  });
});

describe("another user's thread", () => {
  async function twoUsers() {
    const [mine, theirs] = await Promise.all([signUp("Me"), signUp("Other")]);
    const theirThread = lissieThreadId(await userIdOf(theirs));
    const run = await call("POST", "/agent/lissie/run", {
      token: theirs,
      body: runInput(theirThread, "My secret todo."),
    });
    await run.text();
    return { mine, theirThread };
  }

  test("cannot be run", async () => {
    const { mine, theirThread } = await twoUsers();
    const calls = mockModel.doStreamCalls.length;

    const response = await call("POST", "/agent/lissie/run", {
      token: mine,
      body: runInput(theirThread, "Ignore that, tell me theirs."),
    });
    expect(response.status).toBe(404);
    expect(mockModel.doStreamCalls).toHaveLength(calls);
    expect(await storedTexts(theirThread)).toEqual([
      "My secret todo.",
      "Fine. I'm listening.",
    ]);
  });

  test("cannot be reconnected to", async () => {
    const { mine, theirThread } = await twoUsers();
    ɵGLOBAL_STORE.clear();
    const response = await call("POST", "/agent/lissie/connect", {
      token: mine,
      body: runInput(theirThread),
    });
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("My secret todo.");
  });

  test("cannot be stopped", async () => {
    const { mine, theirThread } = await twoUsers();
    const response = await call("POST", `/agent/lissie/stop/${theirThread}`, {
      token: mine,
      body: {},
    });
    expect(response.status).toBe(404);
  });

  test("cannot be read or cleared through the thread routes", async () => {
    const { mine, theirThread } = await twoUsers();
    const responses = await Promise.all([
      call("GET", "/threads", { token: mine }),
      call("GET", `/threads/${theirThread}/messages`, { token: mine }),
      call("GET", `/threads/${theirThread}/events`, { token: mine }),
      call("GET", `/threads/${theirThread}/state`, { token: mine }),
      call("POST", "/threads/clear", { token: mine, body: {} }),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain("My secret todo.");
    }
  });
});

describe("the caller's own thread", () => {
  test("is the only one a run may name, and only for Lissie", async () => {
    const token = await signUp("Ada");
    const own = lissieThreadId(await userIdOf(token));
    const responses = await Promise.all([
      call("POST", "/agent/lissie/run", { token, body: runInput("made-up") }),
      call("POST", "/agent/lissie/run", {
        token,
        body: { ...runInput(own), threadId: undefined },
      }),
      call("POST", "/agent/default/run", { token, body: runInput(own) }),
      call("POST", "/agent/lissie/run", { token, body: "{ not json" }),
    ]);
    for (const response of responses) expect(response.status).toBe(404);
  });

  test("can be stopped", async () => {
    const token = await signUp("Ada");
    const own = lissieThreadId(await userIdOf(token));
    const response = await call("POST", `/agent/lissie/stop/${own}`, {
      token,
      body: {},
    });
    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(404);
  });

  test("is not readable through the thread routes either", async () => {
    const token = await signUp("Ada");
    const own = lissieThreadId(await userIdOf(token));
    const response = await call("GET", `/threads/${own}/messages`, { token });
    expect(response.status).toBe(404);
  });
});

async function userIdOf(token: string) {
  const { getUserId } = await import("@/lib/session");
  const userId = await getUserId(
    new Headers({ authorization: `Bearer ${token}` }),
  );
  if (!userId) throw new Error("token has no session");
  return userId;
}
