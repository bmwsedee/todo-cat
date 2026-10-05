# Authentication

Better Auth 1.7 with email and password only, stored through the Drizzle adapter in the app's SQLite database.
`better-auth`, `@better-auth/drizzle-adapter` and the `auth` CLI are pinned to the same exact version and must be upgraded together.

## Central files

- `lib/auth-options.ts` holds every option except the database: email and password, the bearer and device authorization plugins, and `CLI_CLIENT_ID`.
- `lib/auth.ts` builds the `auth` instance from those options plus the Drizzle adapter on `lib/db.ts`.
- `lib/session.ts` exports `getUserId(headers)`, which returns the signed-in user's id from the session cookie or an `Authorization: Bearer <token>` header, or null.
- `app/api/auth/[...all]/route.ts` mounts Better Auth's HTTP endpoints under `/api/auth`.
- `lib/auth-client.ts` is the browser client the sign-up, log-in and log-out UI uses.
- `lib/auth-schema.ts` holds the generated auth tables and `authRelations`; `lib/schema.ts` re-exports it and `lib/db.ts` passes the relations to Drizzle.

## One way to ask "who is this?"

- Every adapter (pages, the REST API, agent tools, MCP) calls `getUserId` and nothing else reads sessions, so cookie and bearer handling, and any future change to them, live in one place.
- Code that needs more than the id (the home page shows the name) loads it from the `user` table by id.
- Pages check the session server-side and `redirect()`; there is no Proxy, because it would only be an optimistic cookie check on top of that.

## Plugins

- `bearer()` turns `Authorization: Bearer <session token>` into the session cookie before Better Auth reads it, so the REST API and the CLI authenticate with the same sessions as the browser.
- Bearer tokens are the raw session token (from the `set-auth-token` response header or `/device/token`); a signed token works too.
- `deviceAuthorization()` is the first-party flow: the CLI calls `/api/auth/device/code`, the user approves at `/device`, and `/api/auth/device/token` returns a session token that the CLI then sends as its bearer token.
- `validateClient` accepts only `CLI_CLIENT_ID`; the CLI must send exactly that client id.
- The `/device` approval page and the CLI client do not exist yet; the page must require a signed-in user and ask for explicit approval or denial (see the plugin docs).
- We do not use the OAuth Provider plugin's device flow; it issues OAuth access tokens for third-party clients, which we do not have.

## Schema and migrations

- The auth tables come from Better Auth's CLI, never from hand edits: `npm run auth:generate` rewrites `lib/auth-schema.ts`, then `npm run db:generate` writes the migration (see `tech-docs/database.md`).
- Regenerate after adding a plugin or option that changes the schema; when nothing changed, `db:generate` reports no changes.
- The CLI loads `scripts/auth-schema.config.mts` instead of `lib/auth.ts`, because it refuses any config that imports `server-only`, which `lib/db.ts` does.
- That config must use the real `@better-auth/drizzle-adapter/relations-v2` adapter: only it emits Drizzle 1.0 relations (`defineRelationsPart`); `--adapter drizzle` emits the v1 format.

## Tests

- `lib/auth.test.ts` builds a test-only instance with the `testUtils()` plugin on the same options and temp database, so its helpers can create users and sessions while `getUserId` runs against the real instance.
- Keep `testUtils()` out of `lib/auth-options.ts`; it exposes privileged helpers on the auth context.
- `e2e/auth.spec.ts` drives the real sign-up, log-out and log-in flow in the browser.

## Gotchas

- Better Auth rejects POSTs whose origin is not `BETTER_AUTH_URL`, so the Playwright web server sets it to its own URL; a dev server on another port needs the same.
- The secret must be at least 32 characters; the Vitest file stubs one because Vitest does not load `.env`.
- Next's route announcer also has `role="alert"`, so e2e tests must narrow `getByRole("alert")` by text.
- With `advanced.database.joins` on, the adapter queries through `db.query`, so `lib/db.ts` must keep passing `authRelations` (merge future app relations alongside it).
