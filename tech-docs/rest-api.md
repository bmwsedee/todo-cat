# REST API

`/api/todos` is the REST adapter over the todo service (see `tech-docs/architecture.md`), for non-browser clients such as the CLI.
Schemas are the exports of `@todo-cat/contract`; every error body is `errorBodySchema`.

## Endpoints

- `GET /api/todos` — query `listTodosFilterSchema` (`?status=open|done|all`, `?text=`) → 200 `todoListSchema`; 400, 401.
- `POST /api/todos` — body `addTodoInputSchema` → 201 `todoSchema`; 400, 401.
- `GET /api/todos/{id}` → 200 `todoSchema`; 401, 404.
- `PATCH /api/todos/{id}` — body `updateTodoInputSchema` (only the fields present change) → 200 `todoSchema`; 400, 401, 404.
- `DELETE /api/todos/{id}` → 204 with no body; 401, 404.

Status codes map one-to-one to error codes: 400 `validation-failed`, 401 `unauthorized`, 404 `todo-not-found`.

## Central files

- `app/api/todos/rest.ts` holds the shared plumbing: `withUser` (401 and error mapping) and `parse`/`parseBody` (contract schema or 400).
- `app/api/todos/route.ts` and `app/api/todos/[id]/route.ts` are one short handler per endpoint.
- `app/api/todos/route.test.ts` calls the handlers on a temp database with tokens from the real sign-up endpoint.

## Design decisions

- Authentication runs before validation, so a request without a valid user gets 401 whatever its input.
- Query parameters go through the strict filter schema too, so an unknown parameter like `?sort=` is a 400, not silently ignored.
- A body that is not JSON is a 400 `validation-failed`, like a body that fails its schema.
- The id is not validated; an id that is not a todo of the caller's is a 404, just like another user's todo.

## Getting a bearer token with curl

Sign in (or sign up at `/api/auth/sign-up/email` with a `name` as well) and take the `set-auth-token` response header:

```sh
TOKEN=$(curl -s -D - -o /dev/null http://localhost:3000/api/auth/sign-in/email \
  -H 'content-type: application/json' \
  -d '{"email":"demo@todo-cat.dev","password":"cat-person-2026"}' \
  | tr -d '\r' | sed -n 's/^set-auth-token: //Ip')

curl -s 'http://localhost:3000/api/todos?status=open' -H "authorization: Bearer $TOKEN"
curl -s http://localhost:3000/api/todos -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"title":"Buy tuna","dueDate":"2026-10-12"}'
```

The demo user exists after `npm run db:seed`. The token is a session token, valid as long as the session; the CLI gets one through the device flow instead (see `tech-docs/cli.md`).
