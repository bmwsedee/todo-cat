# Lissie, the agent

Lissie is one Mastra agent, embedded in the Next app and served to a CopilotKit chat on `/` over AG-UI.
She has no tools yet, so she can talk about the list but not see or change it; her instructions say so.

```
 / (CopilotChat, v2) ──AG-UI──▶ /api/copilotkit (CopilotKit runtime, multi-route)
                                   │ hooks: 401 without a session, 404 off your own thread
                                   ▼
                     MastraAgent (@ag-ui/mastra, local) ──▶ Mastra agent `lissie`
                                                              │ memory: resource = user id,
                                                              ▼         thread = lissie-<user id>
                                                         SQLite (app DB, Mastra's own tables)
```

## Central files

- `lib/lissie/agent.ts` holds her instructions and the `Agent`; `lib/lissie/model.ts` the model; `lib/lissie/mastra.ts` the `Mastra` instance and its storage.
- `app/api/copilotkit/runtime.ts` builds the CopilotKit runtime and the authorization hooks; `[[...slug]]/route.ts` mounts it for GET and POST.
- `lib/lissie/runner.ts` and `lib/lissie/history.ts` replay a thread from Mastra memory on connect.
- `lib/lissie/thread.ts` derives the user's one thread id; `app/lissie-chat.tsx` is the provider, the chat and the eyes.

## Model

- OpenRouter through Mastra's model router: `openrouter/${OPENROUTER_MODEL}`, default `z-ai/glm-5.3-flash`; check a new id with the mastra skill's `provider-registry.mjs --provider openrouter`.
- Mastra reads `OPENROUTER_API_KEY` itself; only `lib/` modules marked `server-only` touch the model, so the key never reaches the browser.

## Memory

- `LibSQLStore` gets `db.$client`, so Mastra shares Drizzle's connection to the app's SQLite file; it creates its `mastra_*` tables itself on first use, outside Drizzle's migrations and `lib/schema.ts`.
- One thread per user: thread id `lissie-<user id>`, Mastra resource id = the Better Auth user id from the server-side session, never from the request body.
- Mastra refuses to use a thread under another resource than the one that created it, a second line behind the runtime's own check.
- The client sends only the new message (`messageFilter`); Mastra loads history itself (`lastMessages: 20`), and `@ag-ui/mastra` drops any message id Mastra already stored.

## Authorization

The runtime's routes are an authorization surface of their own, not just a transport:

- `onRequest` runs before routing on every request and answers 401 without a session cookie or bearer token.
- `onBeforeHandler` lets through only `GET /info` and `run`, `connect` and `stop` on agent `lissie` for the caller's own thread (in the body for run and connect, in the path for stop); everything else is 404.
- That 404 covers the in-memory runner's `/threads` routes, which resolve no user: they would list, read and clear every user's threads.
- The agents factory resolves the user again to scope Mastra memory, so the resource id never depends on hook order.
- `app/api/copilotkit/route.test.ts` checks each rule, with a mock model (`ai/test`) and a temp database.

## History after a restart

- CopilotKit's `InMemoryAgentRunner` replays only runs since the process started, so `MastraHistoryRunner` answers `connect` on an idle thread with a `MESSAGES_SNAPSHOT` from Mastra memory instead.
- A live run exists only in memory, so `connect` during a run still goes to the in-memory runner.
- The chat passes the thread id explicitly, which makes CopilotKit connect on mount and hides its generic welcome screen.
- `toChatMessages` keeps only the text of user and assistant messages; once Lissie has tools, tool calls need converting too.

## UI

- The provider is on `/` only, in a client component, as CopilotKit requires; it uses the v2 API (`@copilotkit/react-core/v2`) and the multi-route runtime (`useSingleEndpoint={false}`).
- `app/globals.css` maps CopilotKit's shadcn tokens to ours and overrides what ignores them: message prose (Tailwind Typography), the copy button, the input and the send button.
- CopilotKit's own dark mode keys off a `.dark` class, ours off `prefers-color-scheme`; an extension that adds `.dark` once gave a dark chat with light-scheme ink, so every chat rule starts with `:root body` to outrank `.dark [data-copilotkit]` and `cpk:dark:*`.
- `color-scheme: light dark` (CSS and the viewport meta) tells forced-dark browsers that both schemes are designed.
- Check contrast in four setups after a CopilotKit upgrade: light and dark preference, each with and without `.dark` on `<html>`.
- The dev Inspector is off: the runtime rejects the routes it would call.
- A failed run shows an alert under the input, cleared by the next run; her eyes half-close while she answers.

## Tests

- `e2e/chat.spec.ts` (in QA) checks the chat renders and connects for a new user without calling the model.
- `npm run test:e2e:model` (`playwright.model.config.ts`, `e2e-model/`) talks to the real model: two turns, a reload that replays them, and a second user who sees none of it. It needs a real `OPENROUTER_API_KEY` and stays out of QA and CI.

## Gotchas

- Mastra routes by the record key in `new Mastra({ agents: { lissie } })`, and CopilotKit's `agentId` must match that key.
- The runtime logs a telemetry notice; CopilotKit sends usage telemetry unless `COPILOTKIT_TELEMETRY_DISABLED=true`.
- `@ag-ui/mastra` pulls in `@mastra/client-js`, which npm resolves with a zod warning; harmless for the local agent path.
