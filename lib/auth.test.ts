// @vitest-environment node
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { betterAuth } from "better-auth/minimal";
import { type TestHelpers, testUtils } from "better-auth/plugins";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { stubTempDatabase } from "@/test/temp-database";

// `server-only` throws outside a React Server Components bundle, which Vitest is not.
vi.mock("server-only", () => ({}));

const removeTempDatabase = stubTempDatabase();
vi.stubEnv("BETTER_AUTH_SECRET", "vitest-secret-that-is-at-least-32-chars");
vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
const { db } = await import("@/lib/db");
const { adapterConfig, authOptions } = await import("@/lib/auth-options");
const schema = await import("@/lib/schema");
const { getUserId } = await import("@/lib/session");

// A test-only instance with the test-utils plugin, on the same options and database as `lib/auth.ts`,
// so sessions it creates are the ones `getUserId` (which uses the real instance) has to recognise.
const testAuth = betterAuth({
  ...authOptions,
  database: drizzleAdapter(db, { ...adapterConfig, schema }),
  plugins: [...authOptions.plugins, testUtils()],
});
let helpers: TestHelpers;

const credentials = {
  name: "Ada",
  email: "ada@example.com",
  password: "correct horse battery",
};

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
  helpers = (await testAuth.$context).test;
});

afterAll(() => removeTempDatabase(db.$client));

test("signs up with email and password", async () => {
  const { user } = await testAuth.api.signUpEmail({ body: credentials });

  expect(user.email).toBe(credentials.email);
  expect(user.name).toBe(credentials.name);
});

test("signs in with the right password", async () => {
  const { user, token } = await testAuth.api.signInEmail({
    body: { email: credentials.email, password: credentials.password },
  });

  expect(user.email).toBe(credentials.email);
  expect(token).toBeTruthy();
});

test("rejects a wrong password", async () => {
  await expect(
    testAuth.api.signInEmail({
      body: { email: credentials.email, password: "wrong horse battery" },
    }),
  ).rejects.toMatchObject({ statusCode: 401 });
});

test("getUserId returns the user id for a session cookie", async () => {
  const user = await helpers.saveUser(helpers.createUser());
  const headers = await helpers.getAuthHeaders({ userId: user.id });

  expect(headers.get("cookie")).toBeTruthy();
  expect(await getUserId(headers)).toBe(user.id);
});

test("getUserId returns the user id for a bearer token", async () => {
  const user = await helpers.saveUser(helpers.createUser());
  const { token } = await helpers.login({ userId: user.id });
  const headers = new Headers({ authorization: `Bearer ${token}` });

  expect(await getUserId(headers)).toBe(user.id);
});

test("getUserId returns null without a cookie or bearer token", async () => {
  expect(await getUserId(new Headers())).toBeNull();
});

test("getUserId returns null for an unknown bearer token", async () => {
  const headers = new Headers({ authorization: "Bearer not-a-session" });

  expect(await getUserId(headers)).toBeNull();
});
