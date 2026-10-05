---
name: todo-cat-cli
description: Manage a person's to-do list (Lissie's list, todo-cat) with the `todo-cat` CLI - adding, finding, editing, completing, reopening and deleting todos, and answering questions about the list like "what's overdue?", "what did I finish last week?" or "what's due before Friday?". Use this whenever the user talks about their todos, tasks, to-do list, reminders or things they need to do, even if they don't name the CLI, and whenever you are about to run `todo-cat` or `npx todo-cat`. Not for changing the CLI's source code.
---

# Managing a to-do list with `todo-cat`

`todo-cat` is a client of the todo-cat server's REST API. You act for one person, on their list, through it and nothing else.

**`todo-cat --help` is the source of truth.** Every command has `--help` with examples, and the top-level help lists the environment variables and exit codes. When this skill and the help disagree, the help wins; the skill describes workflows and pitfalls, not flags.

Run it as `todo-cat`, or as `npx todo-cat` from the todo-cat repository when it is not on the PATH. `TODO_CAT_URL` picks the server (default `http://localhost:3000`).

## Output and errors

- Pass `--json` whenever you will read the result: stdout is then one JSON document (a todo, or an array of todos), and errors on stderr are `{"error":{"code","message"}}`.
- A todo looks like `{"id","title","dueDate","done","createdAt","completedAt"}`. `dueDate` is a plain `yyyy-mm-dd` or `null`; `createdAt` and `completedAt` are UTC timestamps like `2026-10-04T15:00:00.000Z`.
- Act on the exit code and error code, not on guesses: 3 means not logged in (see below), 4 means no todo with that id, 5 means bad input such as an empty title or a date that isn't `yyyy-mm-dd`, 6 means no server answers. The help has the full table.
- The CLI never prompts and never reads stdin, so nothing hangs waiting for input, except `login`, which waits for a human on purpose.

## Login is a prerequisite you cannot replace

Every todo command needs a session. If a command exits 3 with `unauthorized` (or `whoami` does), the person has to log in, and only they can approve it. Stop the task and tell them, for example:

> I can't reach your to-do list: todo-cat isn't logged in to http://localhost:3000. Run `todo-cat login` and approve the code in your browser, then ask me again.

If they'd rather you start it: run `todo-cat login` in the background, pass on the code and the URL it prints to stderr, and wait for it to exit (0 is logged in; `login-denied` and `login-expired` also exit 3).

Never work around a missing or expired login. Don't sign in with credentials you find in the repo, seed data or docs, create accounts, call the REST API with curl, read or write the database, copy a token from elsewhere, or point `TODO_CAT_URL` or `TODO_CAT_CONFIG_DIR` somewhere else. Each of those either acts as someone other than the person or touches data the CLI is there to guard, and the person would be surprised to find a list that isn't theirs. `server-unreachable` (exit 6) is the same: report that the server isn't answering at that URL instead of starting one or switching servers.

## Find by title, then act on the id

Commands that change a todo take its id, and people name todos by what they say, not by id. So:

1. Search: `todo-cat list --status all --text "<word>" --json`. `list` shows only open todos by default; add `--status all` whenever the todo might be done (reopening, "did I already…?"), and `--text` matches any part of the title, case-insensitively. Use one distinctive word rather than the person's whole phrase ("the vet thing" → `--text vet`).
2. Decide:
   - Exactly one match: act on its id.
   - Several plausible matches: don't pick one. Show them (title, due date, done) and ask which.
   - None: try another word or the full list before saying it doesn't exist; if it really isn't there, say so rather than acting on something close.
3. Act with the id from that list, never an id you remember from earlier in the conversation or made up; ids are UUIDs and a stale one fails with `todo-not-found`.
4. Confirm what changed, using the title and the command's result, so the person can see you hit the right one.

Before `add`, a quick `--text` search avoids a duplicate when the person may already have that todo; if a similar one exists, mention it and ask.

## Questions about the list: `--json` plus jq

For anything beyond "show me my list", fetch everything once and answer with jq instead of reading the text output by eye:

```sh
todo-cat list --status all --json > todos.json   # or pipe straight into jq
jq -r '.[] | select(.done | not) | select(.dueDate != null and .dueDate < "2026-10-05") | "\(.dueDate)  \(.title)"' todos.json
jq '[.[] | select(.done)] | length' todos.json
```

- Get today's date from the system (`date +%F`) instead of assuming it; "overdue", "this week" and "tomorrow" all depend on it.
- Overdue means open, with a `dueDate` before today. A todo without a due date is never overdue; mention those separately if they matter.
- `yyyy-mm-dd` strings compare correctly as strings, so date filters need no date parsing.
- jq's `fromdateiso8601` rejects the milliseconds in `createdAt`/`completedAt`. Compare those as strings too, against bounds in the same format (`"2026-09-28T00:00:00.000Z"`), or compare their first ten characters (`.completedAt[0:10]`) when a few hours of UTC offset don't matter.

## Due dates versus creation and completion dates

A todo has three dates and they answer different questions. Work out which one the person means before filtering:

| The person says | Field | Filter |
| --- | --- | --- |
| "what's due / overdue / coming up", "what do I have this week" | `dueDate` | open todos with a due date in the range |
| "what did I finish / get done / tick off last week" | `completedAt` | done todos completed in the range |
| "what did I add / put on my list last week", "what's new" | `createdAt` | any todo created in the range |

"Last week" is the most common trap: "what was I supposed to do last week" is about due dates, "what did I do last week" about completion, "what did I add last week" about creation. If the phrasing truly doesn't say, pick the most likely reading and name it in your answer ("due between 28 Sep and 4 Oct"), or ask. State the date range you used either way; "last week" can mean the previous Monday–Sunday or the past seven days, and the person can correct you only if they see which.

Timestamps are UTC, the person lives in a local time zone, so a todo completed late on Sunday evening may carry Monday's date in UTC. For week-level questions that rarely matters; when it might, convert the range's local bounds to UTC first.

## Changing todos

- `done` and `reopen` are the normal way to finish or revive a todo; prefer them over deleting. "I did X", "tick off X", "X is done" all mean `done`, not `delete`.
- `edit` changes only the title or the due date. Relative dates ("next Friday", "in two weeks") must become a real `yyyy-mm-dd` computed from today; say which date you picked. `--no-due` removes a due date.
- Several changes at once ("mark the bill and the books as done"): find every id first, resolve any ambiguity, then run the commands and report each result.

## Destructive commands only on request

`delete` removes a todo for good; there is no undo and no trash. Run it only when the person asks to delete or remove that todo, and pass `--yes` only then. The flag is the person's confirmation, not a hurdle to clear.

- Don't delete to "clean up" done todos, duplicates you noticed, or todos that look like tests unless the person asks. Point them out instead.
- Don't delete and re-add to edit a todo; use `edit`, which keeps its id and dates.
- For a bulk delete ("delete everything I finished in September"), list exactly what would go and get a yes on that list before deleting.
- `logout` revokes the session, and logging back in needs the person. Run it only when they ask.
