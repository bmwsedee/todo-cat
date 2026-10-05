// @vitest-environment node
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { type Todo, todoListSchema, todoSchema } from "@todo-cat/contract";
import { betterAuth } from "better-auth/minimal";
import { type TestHelpers, testUtils } from "better-auth/plugins";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { stubTempDatabase } from "@/test/temp-database";

// Drives the built CLI end to end against a real `next dev` on a spare port, with a temp
// database and a temp config directory. A test-only Better Auth instance on the same
// database creates the user who approves the login. See tech-docs/cli.md.

vi.mock("server-only", () => ({}));

const root = fileURLToPath(new URL("../..", import.meta.url));
const port = await freePort();
const baseURL = `http://localhost:${port}`;
const secret = "vitest-secret-that-is-at-least-32-chars";
const configDir = mkdtempSync(join(tmpdir(), "todo-cat-cli-config-"));

const removeTempDatabase = stubTempDatabase();
vi.stubEnv("BETTER_AUTH_SECRET", secret);
vi.stubEnv("BETTER_AUTH_URL", baseURL);
const { db } = await import("@/lib/db");
const { adapterConfig, authOptions } = await import("@/lib/auth-options");
const schema = await import("@/lib/schema");

const testAuth = betterAuth({
  ...authOptions,
  database: drizzleAdapter(db, { ...adapterConfig, schema }),
  plugins: [...authOptions.plugins, testUtils()],
});
let helpers: TestHelpers;
let server: ChildProcess;
let serverLog = "";

beforeAll(async () => {
  // One command string: npm is a script on Windows, so it needs a shell.
  const build = spawnSync("npm run build -w todo-cat-cli", {
    cwd: root,
    shell: true,
    encoding: "utf8",
  });
  expect(build.status, build.stderr).toBe(0);

  await migrate(db, { migrationsFolder: join(root, "drizzle") });
  helpers = (await testAuth.$context).test;
  server = startServer();
  await waitForServer();
}, 180_000);

afterAll(async () => {
  if (server) await stopServer(server);
  await removeTempDatabase(db.$client);
  await rm(configDir, { recursive: true, force: true });
});

const email = "ada@example.com";
let todo: Todo;
let token: string;

test("login prints a code, waits for approval and stores the token owner-only", async () => {
  const login = startCli("login", "--json");
  const prompt = JSON.parse(await firstLine(login.stderr));
  expect(prompt.verificationUri).toBe(`${baseURL}/device`);
  expect(prompt.verificationUriComplete).toContain("user_code=");

  await approve(prompt.userCode);
  const { code, stdout, stderr } = await finished(login);

  expect(code, stderr).toBe(0);
  expect(JSON.parse(stdout)).toMatchObject({
    server: baseURL,
    user: { email },
  });
  const credentials = join(configDir, "credentials.json");
  token = JSON.parse(readFileSync(credentials, "utf8")).servers[baseURL].token;
  expect(token).toBeTruthy();
  expect(stdout + stderr).not.toContain(token);
  if (process.platform !== "win32") {
    expect(statSync(credentials).mode & 0o777).toBe(0o600);
  }
}, 60_000);

test("whoami shows the logged-in user", async () => {
  const { code, stdout } = await cli("whoami");

  expect(code).toBe(0);
  expect(stdout).toContain(email);
}, 30_000);

test("add creates a todo", async () => {
  const { code, stdout } = await cli(
    "add",
    "Buy tuna",
    "--due",
    "2026-10-12",
    "--json",
  );

  expect(code).toBe(0);
  todo = todoSchema.parse(JSON.parse(stdout));
  expect(todo).toMatchObject({
    title: "Buy tuna",
    dueDate: "2026-10-12",
    done: false,
  });
}, 30_000);

test("list shows open todos, as text and as JSON", async () => {
  const text = await cli("list");
  const json = await cli("list", "--json");

  expect(text.code).toBe(0);
  expect(text.stdout).toContain(`[ ] ${todo.id}  Buy tuna  due 2026-10-12`);
  expect(todoListSchema.parse(JSON.parse(json.stdout))).toEqual([todo]);
}, 30_000);

test("done marks the todo done, so it leaves the open list", async () => {
  const done = await cli("done", todo.id, "--json");
  const open = await cli("list", "--json");
  const all = await cli("list", "--status", "done", "--json");

  expect(done.code).toBe(0);
  expect(JSON.parse(done.stdout)).toMatchObject({ id: todo.id, done: true });
  expect(JSON.parse(open.stdout)).toEqual([]);
  expect(JSON.parse(all.stdout)).toMatchObject([{ id: todo.id }]);
}, 30_000);

test("delete needs --yes, then deletes", async () => {
  const refused = await cli("delete", todo.id, "--json");
  const deleted = await cli("delete", todo.id, "--yes");
  const gone = await cli("show", todo.id, "--json");

  expect(refused.code).toBe(2);
  expect(JSON.parse(refused.stderr).error.code).toBe("usage-error");
  expect(deleted.code).toBe(0);
  expect(gone.code).toBe(4);
  expect(JSON.parse(gone.stderr)).toMatchObject({
    error: { code: "todo-not-found" },
  });
}, 30_000);

test("logout revokes the session on the server, after which whoami fails", async () => {
  const logout = await cli("logout");
  const whoami = await cli("whoami", "--json");
  const withOldToken = await fetch(`${baseURL}/api/todos`, {
    headers: { authorization: `Bearer ${token}` },
  });

  expect(logout.code).toBe(0);
  expect(whoami.code).toBe(3);
  expect(JSON.parse(whoami.stderr)).toMatchObject({
    error: { code: "unauthorized" },
  });
  expect(withOldToken.status).toBe(401);
}, 30_000);

/** Approves a login code the way the /device page does: claim it while signed in, then approve. */
async function approve(userCode: string) {
  const user = await helpers.saveUser(helpers.createUser({ email }));
  const headers = await helpers.getAuthHeaders({ userId: user.id });
  headers.set("origin", baseURL);
  headers.set("content-type", "application/json");

  const claim = await fetch(
    `${baseURL}/api/auth/device?user_code=${encodeURIComponent(userCode)}`,
    { headers },
  );
  expect(claim.status).toBe(200);
  const approval = await fetch(`${baseURL}/api/auth/device/approve`, {
    method: "POST",
    headers,
    body: JSON.stringify({ userCode }),
  });
  expect(approval.status).toBe(200);
}

function startCli(...args: string[]) {
  return spawn(
    process.execPath,
    [join(root, "cli/bin/todo-cat.mjs"), ...args],
    {
      env: {
        ...process.env,
        TODO_CAT_URL: baseURL,
        TODO_CAT_CONFIG_DIR: configDir,
      },
    },
  );
}

function cli(...args: string[]) {
  return finished(startCli(...args));
}

async function finished(child: ChildProcess) {
  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr?.on("data", (chunk) => {
    stderr += chunk;
  });
  const [code] = await once(child, "close");
  return { code: code as number, stdout, stderr };
}

/** Resolves with the first complete line of a stream, such as the login prompt. */
function firstLine(stream: NodeJS.ReadableStream | null): Promise<string> {
  return new Promise((resolve, reject) => {
    let text = "";
    stream?.on("data", (chunk) => {
      text += chunk;
      const end = text.indexOf("\n");
      if (end >= 0) resolve(text.slice(0, end));
    });
    stream?.on("end", () => reject(new Error(`No line in: ${text}`)));
  });
}

async function freePort(): Promise<number> {
  const probe = createServer().listen(0);
  await once(probe, "listening");
  const address = probe.address();
  probe.close();
  if (!address || typeof address === "string") throw new Error("No port");
  return address.port;
}

function startServer(): ChildProcess {
  const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
  const child = spawn(process.execPath, [next, "dev", "--port", String(port)], {
    cwd: root,
    // Its own build dir, so it runs beside `npm run dev` and the Playwright server.
    env: { ...process.env, NEXT_DIST_DIR: ".next-e2e-cli" },
    // Its own process group on POSIX, so stopServer can kill next's workers with it.
    detached: process.platform !== "win32",
  });
  child.stdout?.on("data", (chunk) => {
    serverLog += chunk;
  });
  child.stderr?.on("data", (chunk) => {
    serverLog += chunk;
  });
  return child;
}

async function waitForServer() {
  const deadline = Date.now() + 150_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) break;
    try {
      // Also compiles the routes the CLI uses, so the tests' own timeouts stay short.
      const session = await fetch(`${baseURL}/api/auth/get-session`);
      const todos = await fetch(`${baseURL}/api/todos`);
      if (session.ok && todos.status === 401) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`The server did not start:\n${serverLog}`);
}

async function stopServer(child: ChildProcess) {
  if (child.exitCode !== null) return;
  const exited = once(child, "exit");
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"]);
  } else if (child.pid) {
    process.kill(-child.pid, "SIGTERM");
  }
  await exited;
}
