# Workspaces

The repo root is the Next.js web app and also the npm workspace root; `package.json` declares `contract` and `cli` as workspaces.

## Layout

- Root (`app/`): the web app, where Lissie and the to-do list will live.
- `contract/` (`@todo-cat/contract`): the zod schemas that define the data shapes shared by the web app and the CLI.
- `cli/` (`todo-cat-cli`): the todo-cat command-line client.

## Why it exists before its content does

- The web app and the CLI must agree on the same data shapes, so those shapes live in one package that both import instead of being defined twice and drifting apart.
- Fixing the package names and folders up front means the first schema or CLI command lands in a known place, and imports use the package name (`@todo-cat/contract`) from day one rather than relative paths that would later be rewritten.
- The folders hold only a `package.json` because npm requires every listed workspace to exist; do not delete them while they are empty.

## Gotchas

- Run `npm install` from the repo root, never inside a workspace, so there is one lockfile and the workspaces get linked into the root `node_modules`.
- Add a dependency to a single workspace with `npm install <pkg> -w <workspace>`.
