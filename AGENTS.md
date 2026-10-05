<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# todo-cat

A to-do list web app kept by Lissie, a cat with attitude who will be an AI agent (not built yet).
It is a Next.js 16 App Router app (`app/`) with two npm workspaces, `contract/` (shared zod schemas) and `cli/` (the `todo-cat` CLI, a REST client).

## Commands

Run from the repo root.

- `npm run dev` starts the dev server on http://localhost:3000.
- `npm run build` builds for production; `npm run start` serves that build.
- `npm run lint` runs `biome check` (lint + format check, warnings fail).
- `npm run format` applies Biome formatting.
- `npm test` runs the Vitest unit and integration tests; `npm run test:e2e` runs the Playwright end-to-end tests.
- `npm run qa` runs every check (Biome, typecheck, build, Vitest, Playwright); CI runs the same script.
- `npm run auth:generate` regenerates the auth tables in `lib/auth-schema.ts` with Better Auth's CLI; follow it with `npm run db:generate`.
- `npm run db:generate` writes a migration from `lib/schema.ts`, `npm run db:migrate` applies pending ones, `npm run db:reset` recreates the local database.
- `npx todo-cat --help` runs the CLI (built on `npm install`; rebuild with `npm run build -w todo-cat-cli`), against `TODO_CAT_URL` (default http://localhost:3000).
- `npm run db:seed` fills the local database with the demo user `demo@todo-cat.dev` (password `cat-person-2026`) and their todos; safe to rerun.

## Done means QA passes

- Run `npm run qa` before you call a task done, and read `qa.log` only when the printed failure is not enough.
- Fix the code instead of suppressing findings: no `biome-ignore`, `@ts-expect-error`, skipped tests or loosened config to turn a check green.

## Verify, don't recall

- Next.js, React, Tailwind, Biome, Drizzle and Better Auth here are newer than your training data, so check APIs against current docs (see the next section) instead of memory.

## Researching docs

- Next.js: the guides in `node_modules/next/dist/docs/`, which match the installed version.
- Vendors that publish an `llms.txt` index: start there and follow its links, e.g. Drizzle at https://orm.drizzle.team/llms.txt (use the `/docs/sqlite/…` pages, which cover the 1.0 release we use) and Better Auth at https://better-auth.com/llms.txt (fetch the `.md` URL of a page).
- Libraries with an installed skill in `.claude/skills/` (Mastra, CopilotKit; `impeccable` and `frontend-design` for UI work): load the skill, which points to current docs and source.
- Any other library: the ctx7 CLI from the `find-docs` skill (`npx ctx7@latest library <name> "<query>"`, then `docs <id> "<query>"`).
- Type definitions in `node_modules/<pkg>` are the final word on an installed version's API.

## Tech docs

`tech-docs/` holds project-specific technical docs written primarily for agents.

- Describe approach, principles, design decisions with their reasons, and gotchas.
- Point to the central files instead of copying code.
- Leave out anything an agent finds out by reading the code.
- Describe the current state only; delete outdated content instead of adding caveats.

Index:

- [architecture.md](tech-docs/architecture.md) — the todo service as the single owner-scoped core, the shared contract, and thin adapters around it.
- [workspaces.md](tech-docs/workspaces.md) — the workspace layout and why it exists before its content does.
- [testing.md](tech-docs/testing.md) — the Vitest and Playwright setup, the QA script, CI, and the e2e dev-server quirks.
- [database.md](tech-docs/database.md) — Drizzle on SQLite via libsql, migrations, and the test databases.
- [auth.md](tech-docs/auth.md) — Better Auth (email and password, bearer, device authorization), `getUserId`, and schema generation.
- [rest-api.md](tech-docs/rest-api.md) — the `/api/todos` endpoints, their contract schemas and status codes, and a bearer token with curl.
- [cli.md](tech-docs/cli.md) — the `todo-cat` CLI: agent-friendly output and exit codes, device-flow login, token storage, the `/device` page, the build and its end-to-end test.

## Keeping this map current

When your change invalidates a line here or in `tech-docs/`, or teaches a costly lesson, update AGENTS.md and the tech docs in that same change.
Prefer deleting over adding, pointers over prose, and one sentence per bullet.
