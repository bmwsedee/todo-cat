# Lissie, the agent

Lissie is one Mastra agent, embedded in the Next app and served to a CopilotKit chat on `/` over AG-UI.
Her tools (`listTodos`, `addTodo`, `setTodoDone`, `showProgress`) are the agent adapter on the todo service, and she is the browser's only write path; the sidebar next to the chat is read-only.

```
 / (CopilotChat, v2) ──AG-UI──▶ /api/copilotkit (CopilotKit runtime, multi-route)
                                   │ hooks: 401 without a session, 404 off your own thread
                                   ▼
                     A2UI middleware: tool result with A2UI ──▶ card in the chat
                     MastraAgent (@ag-ui/mastra, local) ──▶ Mastra agent `lissie`
                     requestContext { userId }                │ memory: resource = user id,
                                                              │         thread = lissie-<user id>
                                                              │ tools ──▶ todo service, owner = userId
                                                              ▼
                                                         SQLite (app DB, Mastra's own tables)
```

## Central files

- `lib/lissie/agent.ts` holds her instructions and the `Agent`; `lib/lissie/model.ts` the model; `lib/lissie/mastra.ts` the `Mastra` instance and its storage.
- `lib/lissie/tools.ts` holds the tools and `lissieRequestContext`; `lib/lissie/tool-schemas.ts` their input and output schemas, shared with the chat that renders them.
- `app/api/copilotkit/runtime.ts` builds the CopilotKit runtime and the authorization hooks; `[[...slug]]/route.ts` mounts it for GET and POST.
- `lib/lissie/runner.ts` and `lib/lissie/history.ts` replay a thread from Mastra memory on connect.
- `lib/lissie/progress-card.ts` holds the progress card's A2UI component tree; `components/a2ui-catalog.tsx` the chat's A2UI catalog (`components/progress-bar.tsx` is its ProgressBar), under the id in `lib/a2ui.ts`.
- `lib/lissie/thread.ts` derives the user's one thread id; `app/lissie-chat.tsx` is the provider, the chat, its tool-call lines and the eyes; `app/todo-sidebar.tsx` is the list beside it.

## Model

- OpenRouter through Mastra's model router: `openrouter/${OPENROUTER_MODEL}`, default `z-ai/glm-5.3-flash`; check a new id with the mastra skill's `provider-registry.mjs --provider openrouter`.
- Mastra reads `OPENROUTER_API_KEY` itself; only `lib/` modules marked `server-only` touch the model, so the key never reaches the browser.

## Memory

- `LibSQLStore` gets `db.$client`, so Mastra shares Drizzle's connection to the app's SQLite file; it creates its `mastra_*` tables itself on first use, outside Drizzle's migrations and `lib/schema.ts`.
- One thread per user: thread id `lissie-<user id>`, Mastra resource id = the Better Auth user id from the server-side session, never from the request body.
- Mastra refuses to use a thread under another resource than the one that created it, a second line behind the runtime's own check.
- The client sends only the new message (`messageFilter`); Mastra loads history itself (`lastMessages: 20`), and `@ag-ui/mastra` drops any message id Mastra already stored.

## Tools

- The user id reaches a tool one way only: the runtime's agents factory resolves the session user and passes `lissieRequestContext(userId)` to the `MastraAgent` it builds, and each tool reads `userId` from Mastra's request context.
- The bridge writes only its own `ag-ui` key (the client's AG-UI context) into that request context, so neither the browser nor the model can set `userId`.
- The input schemas are the contract's strict schemas (plus a strict `{ id, done }`), so a `userId` argument the model makes up fails validation instead of being ignored.
- Tools and agent declare `requestContextSchema`: a run without `userId` fails before the model is called, and a tool called without it returns Mastra's validation error without touching the service.
- `setTodoDone` returns the contract's error body for `todo-not-found` rather than throwing, so the model can say it failed and the chat can render a line for it.
- Her instructions carry today's date (UTC on the server) for due dates, tell her to list before changing anything, and to comment in character on every todo she adds or completes; cat chores get opinions.

## Cards (A2UI)

- `showProgress` counts total, done and open from the todo service and returns A2UI v0.9 operations (`createSurface`, `updateComponents`, `updateDataModel`) in an `{ a2ui_operations }` container; the model supplies no numbers and there is no second model call.
- The runtime's A2UI middleware (`a2ui` on `CopilotRuntime`) finds that container in the tool result and emits an `a2ui-surface` activity, which the chat renders with the catalog passed to the provider; the tool call itself renders no line.
- The tree is fixed in `progress-card.ts` and binds the numbers by path (`{ path: "/done" }`, `formatString` with `${/open}`); the data model is the only place they appear.
- The catalog is the basic catalog plus `ProgressBar`; the root is a `Column`, because the basic `Card` hard-codes a white background that is unreadable under dark-scheme ink.
- No generated UI: `injectA2UITool: false` on the runtime and on the `MastraAgent`, because the bridge adds a UI-writing `generate_a2ui` tool whenever a request's forwardedProps ask for one, and the browser sets those; this is why the runtime builds the `MastraAgent` itself rather than calling `getLocalAgents`.
- The provider passes `includeSchema: false`, so the catalog's schema and generation guidelines stay out of the run's context.
- `toChatMessages` replays a card as an `activity` message with the middleware's id (`a2ui-surface-<tool call id>`) after its tool result, so it survives a restart.

## Authorization

The runtime's routes are an authorization surface of their own, not just a transport:

- `onRequest` runs before routing on every request and answers 401 without a session cookie or bearer token.
- `onBeforeHandler` lets through only `GET /info` and `run`, `connect` and `stop` on agent `lissie` for the caller's own thread (in the body for run and connect, in the path for stop); everything else is 404.
- That 404 covers the in-memory runner's `/threads` routes, which resolve no user: they would list, read and clear every user's threads.
- The agents factory resolves the user again to scope Mastra memory, so the resource id never depends on hook order.
- `app/api/copilotkit/route.test.ts` checks each rule, with a mock model (`ai/test`) and a temp database; the mock calls `addTodo` for `Add "<title>"`.

## History after a restart

- CopilotKit's `InMemoryAgentRunner` replays only runs since the process started, so `MastraHistoryRunner` answers `connect` on an idle thread with a `MESSAGES_SNAPSHOT` from Mastra memory instead.
- A live run exists only in memory, so `connect` during a run still goes to the in-memory runner.
- The chat passes the thread id explicitly, which makes CopilotKit connect on mount and hides its generic welcome screen.
- `toChatMessages` rebuilds what the chat built live from Mastra's stored parts: an assistant message with the tool calls, a `tool` message with each result, and text after a call in a continuation message.
- Continuation ids copy the bridge's format (`<id>-agui-text`, then `-2`, …), which `MastraAgent.continuationMessageId` keeps private; check it after an `@ag-ui/mastra` upgrade.
- A tool call stored without a result is left out, or the chat would show it running forever.

## UI

- The provider is on `/` only, in a client component, as CopilotKit requires; it uses the v2 API (`@copilotkit/react-core/v2`) and the multi-route runtime (`useSingleEndpoint={false}`).
- `app/globals.css` maps CopilotKit's shadcn tokens to ours and overrides what ignores them: message prose (Tailwind Typography), the copy button, the input and the send button.
- CopilotKit's own dark mode keys off a `.dark` class, ours off `prefers-color-scheme`; an extension that adds `.dark` once gave a dark chat with light-scheme ink, so every chat rule starts with `:root body` to outrank `.dark [data-copilotkit]` and `cpk:dark:*`.
- `color-scheme: light dark` (CSS and the viewport meta) tells forced-dark browsers that both schemes are designed.
- Check contrast in four setups after a CopilotKit upgrade: light and dark preference, each with and without `.dark` on `<html>`.
- The dev Inspector is off: the runtime rejects the routes it would call.
- A failed run shows an alert under the input, cleared by the next run; her eyes half-close while she answers.
- Each tool call renders as one line in words (`useRenderTool` per tool name), built from the call's arguments and its parsed result; the v2 provider has no static `renderToolCalls`.
- The sidebar is a server component fed by `listTodos` in `app/page.tsx`; `router.refresh()` re-renders it when a `TOOL_CALL_RESULT` for `addTodo` or `setTodoDone` arrives, and the chat keeps its state.

## Tests

- `lib/lissie/tools.test.ts` runs the tool executors on a temp database: two users, a made-up `userId` argument, and no request context; for `showProgress` it checks the operations against A2UI's message schema and the catalog, and the numbers against the rows.
- `components/a2ui-catalog.test.tsx` renders the card's operations through the A2UI renderer; `components/progress-bar.test.tsx` covers the bar.
- `route.test.ts` checks that a run's tool call writes to the session user's list only and that the call comes back in the replay after a restart, and that the progress card arrives, is replayed, and never comes with a UI-writing tool.
- `e2e/chat.spec.ts` (in QA) checks the chat renders and connects for a new user without calling the model, and that the sidebar shows todos added over REST.
- `npm run test:e2e:model` (`playwright.model.config.ts`, `e2e-model/`) talks to the real model: two turns, a reload that replays them, and a second user who sees none of it; `tools.spec.ts` asks her to add "buy milk" and finds it in the sidebar without a reload, then has her complete "feed the cat"; `progress.spec.ts` asks how the list is doing and checks the card's numbers, before and after a reload. It needs a real `OPENROUTER_API_KEY` and stays out of QA and CI.

## Gotchas

- A2UI's binder finds bound props by reading zod 3 internals, so component schemas must be zod 3; a zod 4 schema leaves `{ path }` unresolved and React throws error #31.
- `createCatalog` and `createReactComponent` type-check only against A2UI's own copy of zod, so the ProgressBar schema grows out of A2UI's `DataBindingSchema` (`pick({}).extend(...)`) instead of `zod/v3`.
- Biome reads A2UI's `${/path}` interpolation as a JS template mistake; write it in an escaped template literal.
- In development CopilotKit warns that `showProgress` has no tool renderer; the card is its rendering.

- Mastra routes by the record key in `new Mastra({ agents: { lissie } })`, and CopilotKit's `agentId` must match that key; likewise the keys of the agent's `tools` record are the tool names the model and `useRenderTool` see.
- `@ag-ui/mastra` buffers a server tool call and sends START, ARGS, END and RESULT together once the tool has returned (`streamServerToolCalls` is off), so a call's line shows its result straight away.
- `getLocalAgents` takes an untyped `RequestContext`; the tools' schema, not the type, guarantees `userId`.
- A turn with a tool call can be several chat messages, so the model e2e waits for more replies, not exactly one more.
- The runtime logs a telemetry notice; CopilotKit sends usage telemetry unless `COPILOTKIT_TELEMETRY_DISABLED=true`.
- `@ag-ui/mastra` pulls in `@mastra/client-js`, which npm resolves with a zod warning; harmless for the local agent path.
