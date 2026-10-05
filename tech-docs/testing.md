# Testing

Two runners: Vitest for unit and integration tests, Playwright for end-to-end tests in a real browser.
The QA script runs them together with every other check, locally and in CI.

## Strategy

- Vitest (`vitest.config.mts`) runs in jsdom with React Testing Library; use it for pure logic, zod schemas, and synchronous components.
- Playwright (`playwright.config.ts`) drives Chromium against a real `next dev`; use it for user flows and for `async` Server Components, which Vitest cannot render.
- Vitest picks up `**/*.test.{ts,tsx}` anywhere in the repo, including the `contract` and `cli` workspaces, so colocate a test next to the file it covers.
- Playwright specs live in `e2e/` and end in `.spec.ts`, which keeps the two runners from picking up each other's files.
- The smoke tests (`app/page.test.tsx`, `e2e/smoke.spec.ts`) only check that the page renders a heading, so they survive the starter page being replaced.

## Commands

- `npm test` runs Vitest once; `npm run test:watch` keeps it running.
- `npm run test:e2e` runs Playwright, which starts and stops its own dev server.
- Run one test with `npx vitest run <path>` or `npx playwright test <path>`; add `--ui` to Playwright to debug.
- After a fresh clone or a Playwright upgrade, run `npx playwright install chromium` to download the matching browser.

## QA script

- `npm run qa` (`scripts/qa.sh`) runs Biome, typecheck, production build, Vitest and Playwright in that order and exits non-zero if any fails.
- It is written for agents: one `PASS`/`FAIL` line per section, printed output only for failures, no colors, a summary at the end; full output of every section goes to `qa.log` (override with `QA_LOG`).
- Every section runs even after a failure, so one run reports every problem.
- It picks a free `E2E_PORT` unless one is set, so two checkouts or worktrees can run it at the same time.
- Biome runs with `--error-on-warnings` (also in `npm run lint`), because recommended rules such as `noExplicitAny` are only warnings and would otherwise pass.
- `npm run typecheck` runs `next typegen` first, because `next-env.d.ts` and route types are generated and gitignored, then `tsc` over the whole repo (which includes `contract/` and `cli/`), then any workspace's own `typecheck` script.

## CI

- `.github/workflows/ci.yml` runs `npm run qa` on every push and pull request with Node 24 and `npm ci`; there is no deployment.
- It writes a `.env` with values generated per run; never put real secrets in CI.
- Playwright browsers are cached by Playwright version; on a cache hit only the system deps are installed.
- On failure `qa.log` and `test-results/` are uploaded as the `qa-output` artifact.
- Watch a run with `gh run watch --repo bmwsedee/todo-cat`.

## Gotchas

- Next 16 allows one `next dev` per build directory (it holds a lock), so the e2e server sets `NEXT_DIST_DIR=.next-e2e`, which `next.config.ts` reads as `distDir`. That way it runs while `npm run dev` is up.
- Next adds `.next-e2e/types` paths to `tsconfig.json` the first time it sees that `distDir`; those lines are meant to stay committed.
- The e2e server's port (`E2E_PORT`, default 3100), build dir (`E2E_DIST_DIR`, default `.next-e2e`) and database (`E2E_DATABASE_URL`, default a temp-dir file named after the port) are overridable, so parallel runs never share state.
- Keep a custom `E2E_DIST_DIR` starting with `.next-e2e`, which is gitignored; any other name gets added to `tsconfig.json` by Next.
- `reuseExistingServer` is off, so a busy port fails loudly instead of testing whatever server is already listening there.
- Vite 8 resolves tsconfig `paths` (`@/…`) natively through `resolve.tsconfigPaths`, so the Next guide's `vite-tsconfig-paths` plugin is not needed.
- Vitest globals are off, so Testing Library cannot clean up on its own; `vitest.setup.ts` calls `cleanup` after each test.
