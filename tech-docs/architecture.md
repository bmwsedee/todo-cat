# Architecture

todo-cat has one piece of business logic, the todo service, and several thin adapters
around it. Hexagonal (ports and adapters), without the ceremony.

```
 browser pages ─┐
 REST /api/todos ┤                       ┌──────────────┐
 agent tools  ───┼── getUserId(headers) ─▶ todo service ├──▶ lib/db.ts ──▶ SQLite
 MCP over HTTP ──┘                       └──────┬───────┘
                                                │ types and schemas
 CLI and stdio MCP ──▶ REST /api/todos     contract/ (@todo-cat/contract, zod)
```

## The todo service

- One module, `lib/todo-service.ts`, holds every todo query and rule. Nothing else
  touches the `todos` table.
- Use cases, not tables: list (filter by status open/done/all and by text), get, add,
  update (title, due date, done), delete.
- **Every function takes the user id first, and every query filters by it.** There is
  no function that reads or writes todos without an owner.
- Another user's todo is "not found", never "forbidden": the API must not reveal that
  an id exists.
- The service returns contract types (plain objects, dates as ISO strings), never
  Drizzle rows.
- Rule violations are a few typed errors with stable codes (`todo-not-found`,
  `validation-failed`). Adapters map them; they don't invent their own. The service
  throws `TodoError` with a contract `ErrorCode`; adapters turn a failed zod parse into
  `validation-failed` themselves.
- The list order is part of the service, so every adapter shows the same list: open
  first, then by due date (none last), then oldest first.
- `add` and `update` take an optional trailing `now`, so tests and the dev seed control
  timestamps. Adapters never pass it, and agent tools must not expose it.

## Data

- `todos` (in `lib/schema.ts`): id, owner (user id, cascade delete with the user), title,
  optional due date, done, created at, completed at.
- A due date is a date without time and stays an ISO `yyyy-mm-dd` string everywhere.
  A JavaScript `Date` is midnight UTC and shows the previous day west of Greenwich.
- `completed at` is set when a todo is marked done and cleared when it's reopened;
  marking a done todo done again keeps it. A check constraint keeps `done` and
  `completed at` in step.
- Foreign keys are enforced: libsql turns `PRAGMA foreign_keys` on by default.

## The contract

- The `contract/` workspace (`@todo-cat/contract`, one file `contract/src/index.ts`)
  holds the zod schemas for todos, inputs, list filters, and the error body
  `{ error: { code, message } }`, plus what login shares between server, CLI and
  page (the CLI's client id, the login code format).
- Server and clients import the same schemas. The CLI parses every response with
  them, so a server change that breaks the shape fails loudly in the client.
- Validation lives in the schemas, at the adapter boundary. The service trusts its
  typed input but always enforces ownership.
- Input schemas are strict objects, so a misspelled field fails instead of being
  silently dropped.
- The package exports its TypeScript source; Next transpiles workspace packages on its
  own, and Vitest and tsx read TypeScript directly, so there is no build step.

## Adapters

- An adapter does four things: parse the input with a contract schema, resolve the
  user with `getUserId` (from `lib/session.ts`), call the service, map errors to its
  protocol. No business rules in adapters.
- **REST** (`/api/todos`): for non-browser clients. Bearer token or session cookie,
  401 `unauthorized` without either, 404 `todo-not-found`, 400 `validation-failed`.
  Endpoints in `tech-docs/rest-api.md`.
- **CLI** (`cli/`): a client of the REST API, never of the database.
- **Chat** (`/api/copilotkit`): the CopilotKit runtime serving Lissie over AG-UI, with Mastra memory and her tools scoped to the session user; see `tech-docs/agent.md`.
- **Agent tools** (`lib/lissie/tools.ts`): Lissie's `listTodos`, `addTodo` and
  `setTodoDone` call the service directly. The user id comes from the server session
  through Mastra's request context, never from a tool argument the model fills in; see
  `tech-docs/agent.md`.
- **MCP**: over stdio inside the CLI (a REST client again), over HTTP inside the app
  (calls the service, like the REST routes).

## Deliberately not done

- No generic repository, unit of work, or DI container. The service module is the seam;
  tests run it against a temp SQLite file.
- No pagination, sharing between users, soft delete, or optimistic concurrency.

## Tests

- The service is tested against a temp database with **two users for every use case**:
  one user never sees, changes, or deletes the other's todos. `lib/todo-service.test.ts`
  creates two fresh users per test, so tests need no cleanup between them.
- The dev seed (`scripts/seed.mts`) also writes todos through the service.
- Adapter tests cover only the mapping: 401 without a user, error codes, status codes.
