# Database

Drizzle ORM 1.0 (release candidate) on a SQLite file, opened through the `@libsql/client` driver.
The file is named by `DATABASE_URL` in `.env` (`file:./data/app.db`); `data/` is committed empty and ignores its content.

## Central files

- `lib/db.ts` exports the Drizzle instance `db`; it is the only module that opens the database, and it imports `server-only` so a Client Component that imports it fails the build.
- `db` is created with the Drizzle 1.0 relations (`authRelations` for now), which `db.query` and the Better Auth adapter need.
- `lib/schema.ts` is what drizzle-kit reads; it re-exports the generated auth tables from `lib/auth-schema.ts` (see `tech-docs/auth.md`) and holds the app tables (`todos`).
- `drizzle.config.ts` configures drizzle-kit; migrations go to `drizzle/`, which is committed.
- `scripts/delete-db.mts` deletes the database file (and its `-wal`/`-shm`/`-journal` files) named by `DATABASE_URL`, and refuses any URL that is not `file:`.

## Migrations

- The schema in code is the source of truth: change `lib/schema.ts`, run `npm run db:generate`, review the SQL, commit it with the change.
- `db:generate` runs Biome over `drizzle/` afterwards, because drizzle-kit writes snapshots that fail `biome check`.
- `npm run db:migrate` applies pending migrations and records them in the `__drizzle_migrations` table.
- `npm run db:reset` runs `scripts/delete-db.mts` and then `db:migrate`, which leaves an empty, fully migrated database.
- `npm run db:seed` migrates and then runs `scripts/seed.mts`, which (re)creates the demo user `demo@todo-cat.dev` (password `cat-person-2026`) with a dozen todos dated relative to today; rerunning it gives the same state.
- Do not use `drizzle-kit push`; every schema change goes through a committed migration so tests and other checkouts reproduce it.

## Test databases

- Each runner gets its own file, so tests never touch `data/app.db`.
- A Vitest file calls `stubTempDatabase()` from `test/temp-database.ts` before importing `lib/db.ts`, migrates with `drizzle-orm/libsql/migrator` from `drizzle/`, and passes `db.$client` to the returned cleanup in `afterAll`.
- The Playwright web server runs `npm run db:reset` before `next dev`, with `DATABASE_URL` set to the e2e database (see `tech-docs/testing.md`), so every run starts empty.

## Gotchas

- The docs at https://orm.drizzle.team/llms.txt cover v1 under `/docs/sqlite/…`; the npm `latest` tag is still 0.x, so `drizzle-orm` and `drizzle-kit` are pinned to the same exact RC version and must be upgraded together.
- v1 migrations are one folder per migration (`migration.sql` + `snapshot.json`) with no `_journal.json`; answers that mention a journal describe 0.x.
- drizzle-kit and the delete script read `.env` through `@next/env` (`loadEnvConfig`), so they see the same values as Next, and a variable already set in the environment wins; that is how the e2e server redirects them.
- `@next/env` is CommonJS, so the `.mts` script must use its default import.
- `DATABASE_URL` accepts `file:relative/path` (relative to the working directory) and `file:///absolute/path`; the parent directory must exist.
- A Vitest file that opens the database needs `// @vitest-environment node` (the default is jsdom) and `vi.mock("server-only", () => ({}))`, because that package throws outside a React Server Components bundle.
- libsql releases the file only when its native handles are garbage-collected (seconds to a minute after `close()`), and Windows cannot delete an open file, so the cleanup forces a GC first; that is why `vitest.config.mts` passes `--expose-gc` to the workers.
- Next keeps `@libsql/client` out of the server bundle by default (it is on the built-in `serverExternalPackages` list), so `next.config.ts` needs no entry for it.
- A script that imports `lib/db.ts` (like the seed) runs with `tsx --conditions=react-server`: tsx resolves the `@/…` paths and extensionless imports, and the condition makes `server-only` resolve to its empty build. It must load `.env` before it dynamically imports `lib/db.ts`, which reads `DATABASE_URL` on import.
