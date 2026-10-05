import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { defineConfig, devices } from "@playwright/test";

// Port, build dir and database are all overridable, so the suite never collides with
// `npm run dev` or with another checkout running at the same time.
const port = Number(process.env.E2E_PORT) || 3100;
const baseURL = `http://localhost:${port}`;
const distDir = process.env.E2E_DIST_DIR || ".next-e2e";
const databaseUrl =
  process.env.E2E_DATABASE_URL ||
  pathToFileURL(join(tmpdir(), `todo-cat-e2e-${port}.db`)).href;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Starts every run on a freshly migrated database (see tech-docs/database.md).
    command: `npm run db:reset && next dev --port ${port}`,
    url: baseURL,
    // Better Auth rejects requests whose origin is not its base URL, so it must be this server.
    env: {
      NEXT_DIST_DIR: distDir,
      DATABASE_URL: databaseUrl,
      BETTER_AUTH_URL: baseURL,
    },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
