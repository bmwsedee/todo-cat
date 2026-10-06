# UI

One aesthetic direction, **Tortitude**: Lissie is a tortoiseshell cat, torties are known for attitude, and the app wears her coat and her judgement.
Every page uses it, in light and dark (`prefers-color-scheme`), from phone width up.

## The direction

- **Type.** Grenze Gotisch, a readable blackletter (`font-display`), for page headlines (`h1`) and the list's `h2` only: her decrees. Bricolage Grotesque (`font-sans`, the default) for everything people read or type. Never a third face, never all caps.
- **Color.** A cool wall-grey ground (`fog`, `paper`) under warm tortie ink (`ink`, `ink-soft`). Each accent has one job:
  - `amber`: her eyes. `focus`: keyboard focus, which is amber darkened in light mode so the ring holds 3:1 against fog and ink.
  - `ginger`: where her paw has been. Checked boxes, claw marks, the line beside each of her tool calls in the chat. Nothing else.
  - `danger`: delete and errors, including an overdue due date.
- **Layout.** On `/`, the list is the main column on the left and the chat sits beside it, split by a 2px rule; below `lg`, a switch (`app/home-panes.tsx`) shows one pane at a time and keeps both mounted. Sign-in, sign-up and `/device` share one left-aligned column (`PageShell`).
- **Signature: claw marks.** A done todo's title gets three tapered ginger scratches instead of a strikethrough, raked left to right when the user checks it off on the page (`components/claw-marks.tsx`). The same marks, large, fill the empty side of the `PageShell` pages on wide screens. Spend boldness here and nowhere else.
- **Voice.** Sentence case. Lissie's attitude goes in ledes and empty states; buttons and errors stay plain and say what happens ("Delete", "Keep", "Couldn't reach the server…").

## Where things live

- Tokens: `app/globals.css`, as CSS variables on `:root` with a dark override, mapped to Tailwind colors (`bg-ink`, `text-ginger`, …) and fonts in `@theme inline`; animations (`animate-claw`, `animate-arrive`) in `@theme`. Fonts load in `app/layout.tsx`.
- Shared pieces in `components/ui/`: `Button` (variants, sizes) and `focusRing` for any other button-shaped control; `Field`, plus `inputClass` and `inputSizes` for a bare input; `Form`, `FormError`, `FormFooter` and `linkClass`; `PageShell`.
- Brand marks: `components/lissie-eyes.tsx` (they squint while she answers) and `components/claw-marks.tsx`.
- The list: `app/todo-list.tsx` on the Server Actions in `app/todo-actions.ts`, the browser adapter (see `tech-docs/architecture.md`). Changes apply optimistically; the action's `refresh()` brings the server's list back, and Lissie's tool calls refresh it through `router.refresh()` (see `tech-docs/agent.md`).
- Overdue and "due today" are judged against the server's UTC date (`today()` in `lib/due-date.ts`), the one Lissie uses, passed down as a prop so server and browser render the same.

## CopilotKit styling gotchas

- Its components read shadcn-style tokens (`--background`, `--primary`, `--muted`, …); `app/globals.css` maps them to ours under `[data-copilotkit]`.
- Its own dark mode keys off a `.dark` class, ours off `prefers-color-scheme`. Every chat rule starts with `:root body` to outrank `.dark [data-copilotkit]` and `cpk:dark:*`, which also load after our CSS; otherwise an extension that adds `.dark` gives a dark chat with light-scheme ink.
- Message text is Tailwind Typography and reads `--tw-prose-*`, not the shadcn tokens; the copy button hard-codes greys; the input and send button need their own rules. All of these are overridden in `app/globals.css`.
- The user's message bubble is `.copilotKitUserMessage .cpk\:prose`; Lissie's replies are unboxed prose.
- Passing `threadId` hides CopilotKit's welcome screen, so `EmptyChat` in `app/lissie-chat.tsx` is our own overlay. It needs `z-10`, because the chat paints an opaque background over earlier siblings, and `animate-arrive` delays it, because a thread with history is also empty until connecting brings the messages in.
- Don't replace the message view through its `children` render prop to add UI: that path drops virtualization and the cursor.
- `color-scheme: light dark` (CSS and the viewport meta) tells forced-dark browsers that both schemes are designed.

## Other gotchas

- Two Tailwind utilities for the same property on one element don't override by class order, so shared class strings leave size out: inputs take one of `inputSizes`, `Field` a `size` prop.
- Native `confirm()` is never used: deleting asks inline in the row, focuses Keep, and Escape or Keep returns focus to the delete button.
- The delete button hides until row hover or focus only on devices that can hover (`[@media(hover:hover)]`); on touch it is always visible.
- Buttons have `transition-colors`, so a screenshot taken right after switching color scheme catches them mid-fade and looks dim.

## Checking a change

- Take screenshots of the running app with a headless Playwright script: `/`, `/login`, `/signup` and `/device`, at desktop (1440 wide) and phone (390) width, each in light and dark; for chat changes also with `.dark` on `<html>`, after a CopilotKit upgrade too.
- Check contrast after changing a token: text at least 4.5:1 on `fog` and `paper`; focus ring, checkbox borders and claw marks at least 3:1.
