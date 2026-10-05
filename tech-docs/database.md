# Database

Drizzle ORM 1.0 (release candidate) on a SQLite file, opened through the `@libsql/client` driver.
The file is named by `DATABASE_URL` in `.env` (`file:./data/app.db`); `data/` is committed empty and ignores its content.

## Central files

- `lib/db.ts` exports the Drizzle instance `db`; it is the only module that opens the database, and it imports `server-only` so a Client Component that imports it fails the build.
- `lib/schema.ts` holds the tables; it is empty until todos arrive with the architecture and the auth tables with authentication.
- `drizzle.config.ts` configures drizzle-kit; migrations go to `drizzle/`, which is committed and does not exist until the first table is generated.
- `scripts/delete-db.mts` deletes the database file (and its `-wal`/`-shm`/`-journal` files) named by `DATABASE_URL`, and refuses any URL that is not `file:`.

## Migrations

- The schema in code is the source of truth: change `lib/schema.ts`, run `npm run db:generate`, review the SQL, commit it with the change.
- `npm run db:migrate` applies pending migrations and records them in the `__drizzle_migrations` table.
- `npm run db:reset` runs `scripts/delete-db.mts` and then `db:migrate`, which leaves an empty, fully migrated database.
- Do not use `drizzle-kit push`; every schema change goes through a committed migration so tests and other checkouts reproduce it.

## Test databases

- Each runner gets its own file, so tests never touch `data/app.db`.
- Vitest (`lib/db.test.ts`) points `DATABASE_URL` at a temp file, imports `lib/db.ts`, migrates with `drizzle-orm/libsql/migrator` from `drizzle/`, and runs a query.
- The Playwright web server runs `npm run db:reset` before `next dev`, with `DATABASE_URL` set to the e2e database (see `tech-docs/testing.md`), so every run starts empty.

## Gotchas

- The docs at https://orm.drizzle.team/llms.txt cover v1 under `/docs/sqlite/…`; the npm `latest` tag is still 0.x, so `drizzle-orm` and `drizzle-kit` are pinned to the same exact RC version and must be upgraded together.
- v1 migrations are one folder per migration (`migration.sql` + `snapshot.json`) with no `_journal.json`; answers that mention a journal describe 0.x.
- drizzle-kit and the delete script read `.env` through `@next/env` (`loadEnvConfig`), so they see the same values as Next, and a variable already set in the environment wins; that is how the e2e server redirects them.
- `@next/env` is CommonJS, so the `.mts` script must use its default import.
- `DATABASE_URL` accepts `file:relative/path` (relative to the working directory) and `file:///absolute/path`; the parent directory must exist.
- A Vitest file that opens the database needs `// @vitest-environment node` (the default is jsdom) and `vi.mock("server-only", () => ({}))`, because that package throws outside a React Server Components bundle.
- libsql frees the file one event-loop turn after `close()` returns, and Windows cannot delete an open file, so clean up with the async `rm` and `maxRetries`; `rmSync` retries block the event loop and fail every attempt.
- Next keeps `@libsql/client` out of the server bundle by default (it is on the built-in `serverExternalPackages` list), so `next.config.ts` needs no entry for it.
