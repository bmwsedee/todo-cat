# Testing

Two runners: Vitest for unit and integration tests, Playwright for end-to-end tests in a real browser.

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

## Gotchas

- Next 16 allows one `next dev` per build directory (it holds a lock), so the e2e server sets `NEXT_DIST_DIR=.next-e2e`, which `next.config.ts` reads as `distDir`. That way it runs while `npm run dev` is up.
- Next adds `.next-e2e/types` paths to `tsconfig.json` the first time it sees that `distDir`; those lines are meant to stay committed.
- The e2e port is 3100 (override with `E2E_PORT`) and `reuseExistingServer` is off, so a busy port fails loudly instead of testing whatever server is already listening there.
- Vite 8 resolves tsconfig `paths` (`@/…`) natively through `resolve.tsconfigPaths`, so the Next guide's `vite-tsconfig-paths` plugin is not needed.
- Vitest globals are off, so Testing Library cannot clean up on its own; `vitest.setup.ts` calls `cleanup` after each test.
