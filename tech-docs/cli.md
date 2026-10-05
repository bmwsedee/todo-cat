# CLI

`todo-cat` (workspace `cli/`, package `todo-cat-cli`) is a client of the REST API (see `tech-docs/rest-api.md`), never of the database.
Its main users are AI agents working for a human, so its output, errors and exit codes are built to be parsed; humans get readable text from the same commands.
`npx todo-cat --help` lists the commands, examples, environment variables and exit codes; every command has `--help` with examples too.
The project skill `.claude/skills/todo-cat-cli/` teaches agents the workflows on top of it (login, find-then-act, jq questions, due versus creation dates, deleting only on request) and defers to `--help` for flags, so a CLI change that alters a workflow updates the skill too.

## Central files

- `cli/src/program.ts` builds the commander program, its global `--json` option and help, and turns every error into a code and an exit code.
- `cli/src/errors.ts` is the single table of error codes and exit codes; `--help` prints it, so change both there.
- `cli/src/todo-commands.ts` has one command per REST use case; `cli/src/auth-commands.ts` has `login`, `logout` and `whoami`.
- `cli/src/api.ts` holds the REST client (`TodoApi`), the Better Auth client, and the mapping of network failures to `server-unreachable`.
- `cli/src/config.ts` resolves the server URL and the config directory, and reads and writes the credentials file.
- `app/device/` is the web page where a signed-in user approves or denies a login code.

## Contract, not copies

- Request bodies and filters go through the contract's input schemas before they are sent, so bad input fails with `validation-failed` (exit 5) without a round trip.
- Every todo response is parsed with `todoSchema` or `todoListSchema`, and error bodies with `errorBodySchema`; a response outside the contract is `unexpected-error` (exit 1).
- `CLI_CLIENT_ID` and `formatUserCode` live in the contract because the server, the CLI and the `/device` page all need them.
- Login and session calls use Better Auth's own client (`better-auth/client` with `deviceAuthorizationClient`), which types those responses, instead of hand-written schemas.

## Agent-friendly output

- Results go to stdout; errors go to stderr as `error (<code>): <message>`, or with `--json` as the API's error body `{"error":{"code","message"}}`.
- With `--json`, stdout is one JSON document per command (the contract's todo or list for todo commands), and stderr carries only JSON lines.
- `--json` is detected from argv before parsing, so even usage errors come out as JSON.
- Commander's own error printing is switched off (`exitOverride` plus an empty `outputError`); `run` reports its errors as `usage-error` (exit 2).
- Commander signals both an explicit help request and "no command given" with `commander.help`; only its exit code tells them apart (0 versus 1, which we map to 2).
- The CLI never prompts: `delete` refuses without `--yes`, and nothing reads stdin.
- `list` defaults to `--status open`, unlike the API, which defaults to all; a to-do CLI shows what is left to do.

## Login

- `login` runs Better Auth's device authorization flow (see `tech-docs/auth.md`): it requests a code, prints the code and the `/device` URL to stderr (with `--json` as one JSON line), never opens a browser, and polls `/device/token` at the server's interval until the code is approved, denied (`login-denied`) or expired (`login-expired`), all exit 3.
- Because `login` blocks until a human acts, its help tells agents to run it in the background and pass the code and the URL on.
- The access token from `/device/token` is a session token, which the CLI sends as `Authorization: Bearer` to the REST API and to Better Auth.
- `logout` calls `/api/auth/sign-out` with the bearer token, which revokes the session server-side, then forgets the token; if the server is unreachable or fails, it keeps the token so the user can retry.

## Token storage

- The token lives in `credentials.json` in the config directory: `TODO_CAT_CONFIG_DIR`, else `%APPDATA%\todo-cat` on Windows, else `$XDG_CONFIG_HOME/todo-cat` or `~/.config/todo-cat`.
- Tokens are stored per server URL, so a token is only ever sent to the server that issued it; `TODO_CAT_URL` picks the server (default `http://localhost:3000`).
- The file is written through a temp file with mode 0600 in a 0700 directory, and re-chmodded if it already existed; on Windows chmod cannot express that, and the per-user profile's ACL protects it.
- No command prints the token; the integration test checks that it appears in neither stdout nor stderr.

## The `/device` page

- It requires a signed-in user; signed out, it redirects to `/login?next=…`, and login and sign-up return to `next` (only same-site paths, see `lib/next-path.ts`).
- Approving takes two calls: `GET /api/auth/device?user_code=` while signed in claims the code for that user, and only then does `/device/approve` (or `/deny`) accept it.
- The code is prefilled from `?user_code=` and shown as `ABCD-EFGH`, the same form the CLI prints, so the user can compare them.

## Build and `npx todo-cat`

- `npm run build -w todo-cat-cli` bundles `cli/src/main.ts` and all its dependencies into `cli/dist/todo-cat.mjs` with esbuild; the contract ships TypeScript source, which Node cannot load from a package.
- The workspace's `prepare` script runs that build on `npm install`, and npm links the committed shim `cli/bin/todo-cat.mjs` (which imports the bundle) as `node_modules/.bin/todo-cat`, so `npx todo-cat` works from the repo root.
- `cli/dist/` is gitignored; the shim prints how to build if the bundle is missing.
- The QA script builds the CLI in its own `cli-build` section; the root `tsc` already typechecks `cli/`.

## Tests

- `cli/src/todo-cat.test.ts` builds the CLI, starts `next dev` on a spare port with a temp database (`stubTempDatabase`) and a temp `TODO_CAT_CONFIG_DIR`, and runs the bundle as a child process: login, whoami, add, list, done, delete, logout, then whoami failing and the old token getting a 401.
- It approves the login like the `/device` page does, over HTTP, with a session that a test-only Better Auth instance with `testUtils()` creates on the same database and secret.
- The server builds into `.next-e2e-cli`, so it runs beside `npm run dev` and the Playwright server; Next added that dir's paths to `tsconfig.json` once, and they stay committed.
- On Windows the server is stopped with `taskkill /t`, and on POSIX by killing its process group, because `next dev` runs its workers in child processes that would keep the port and the database file open.
- `e2e/device.spec.ts` covers the browser half: sign up from the code link, approve or deny, then redeem the token over HTTP.
