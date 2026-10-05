// @vitest-environment node
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, expect, test, vi } from "vitest";
import { stubTempDatabase } from "@/test/temp-database";

// `server-only` throws outside a React Server Components bundle, which Vitest is not.
vi.mock("server-only", () => ({}));

const removeTempDatabase = stubTempDatabase();
const { db } = await import("@/lib/db");

afterAll(() => removeTempDatabase(db.$client));

test("migrates a fresh database and runs queries on it", async () => {
  await migrate(db, { migrationsFolder: "drizzle" });

  const tables = await db.all<{ name: string }>(
    sql`select name from sqlite_master where type = 'table'`,
  );
  expect(tables.map((t) => t.name)).toContain("__drizzle_migrations");
});
