import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Client } from "@libsql/client";
import { vi } from "vitest";

/**
 * Points DATABASE_URL at a fresh temp file; call it before importing `lib/db.ts`.
 * Returns the cleanup for `afterAll`, which closes the client and deletes the file.
 */
export function stubTempDatabase() {
  const dir = mkdtempSync(join(tmpdir(), "todo-cat-vitest-"));
  vi.stubEnv("DATABASE_URL", pathToFileURL(join(dir, "test.db")).href);

  return async function removeTempDatabase(client: Client) {
    client.close();
    vi.unstubAllEnvs();
    // libsql releases the file only once its native handles are garbage-collected, and Windows
    // cannot delete an open file, so collect first (vitest.config.mts passes `--expose-gc`).
    globalThis.gc?.();
    await rm(dir, { recursive: true, force: true, maxRetries: 10 });
  };
}
