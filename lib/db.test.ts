// @vitest-environment node
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, expect, test, vi } from "vitest";

// `server-only` throws outside a React Server Components bundle, which Vitest is not.
vi.mock("server-only", () => ({}));

const dir = mkdtempSync(join(tmpdir(), "todo-cat-vitest-"));
vi.stubEnv("DATABASE_URL", pathToFileURL(join(dir, "test.db")).href);
const { db } = await import("@/lib/db");

afterAll(async () => {
  db.$client.close();
  vi.unstubAllEnvs();
  // libsql frees the file a tick after close() returns and Windows cannot delete an open file,
  // so retry asynchronously to let the event loop run between attempts.
  await rm(dir, { recursive: true, force: true, maxRetries: 10 });
});

test("migrates a fresh database and runs queries on it", async () => {
  await migrate(db, { migrationsFolder: "drizzle" });

  const tables = await db.all<{ name: string }>(
    sql`select name from sqlite_master where type = 'table'`,
  );
  expect(tables.map((t) => t.name)).toContain("__drizzle_migrations");
});
