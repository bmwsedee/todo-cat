<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# todo-cat

A to-do list web app kept by Lissie, a cat with attitude who will be an AI agent (not built yet).
It is a Next.js 16 App Router app (`app/`) with two npm workspaces, `contract/` (shared zod schemas) and `cli/` (the todo-cat CLI), both still empty.

## Commands

Run from the repo root.

- `npm run dev` starts the dev server on http://localhost:3000.
- `npm run build` builds for production; `npm run start` serves that build.
- `npm run lint` runs `biome check` (lint + format check); it must pass before committing.
- `npm run format` applies Biome formatting.
- `npm test` runs the Vitest unit and integration tests; `npm run test:e2e` runs the Playwright end-to-end tests.

## Verify, don't recall

- Next.js, React, Tailwind and Biome here are newer than your training data, so check APIs against current docs (`node_modules/<pkg>`, official sites) instead of memory.

## Tech docs

`tech-docs/` holds project-specific technical docs written primarily for agents.

- Describe approach, principles, design decisions with their reasons, and gotchas.
- Point to the central files instead of copying code.
- Leave out anything an agent finds out by reading the code.
- Describe the current state only; delete outdated content instead of adding caveats.

Index:

- [workspaces.md](tech-docs/workspaces.md) — the workspace layout and why it exists before its content does.
- [testing.md](tech-docs/testing.md) — the Vitest and Playwright setup, what each is for, and the e2e dev-server quirks.

## Keeping this map current

When your change invalidates a line here or in `tech-docs/`, or teaches a costly lesson, update AGENTS.md and the tech docs in that same change.
Prefer deleting over adding, pointers over prose, and one sentence per bullet.
