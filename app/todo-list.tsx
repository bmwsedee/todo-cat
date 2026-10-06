"use client";

import type { ErrorCode, Todo } from "@todo-cat/contract";
import {
  type FormEvent,
  type RefObject,
  startTransition,
  useEffect,
  useId,
  useLayoutEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { ClawMarks } from "@/components/claw-marks";
import { Button, colorFade, focusRing } from "@/components/ui/button";
import { inputClass, inputSizes } from "@/components/ui/field";
import { FormError } from "@/components/ui/form";
import { formatDueDate } from "@/lib/due-date";
import {
  addTodoAction,
  deleteTodoAction,
  setTodoDoneAction,
  type TodoActionResult,
} from "./todo-actions";

const messages: Record<ErrorCode, string> = {
  unauthorized: "You're logged out. Log in again to change your list.",
  "todo-not-found": "That todo was already gone. Your list is up to date now.",
  "validation-failed":
    "A todo needs a title of up to 200 characters, and a real date if it has a due date.",
};
const unreachable =
  "Couldn't reach the server. Check your connection and try again.";

// How long a todo checked off here stays put while the claw marks rake across it (340ms),
// plus a beat to see it done, before it moves to Done.
const rakeHoldMs = 900;

/** A todo as the list shows it; `pending` while the server is still adding it. */
type Shown = Todo & { pending?: true };

type Change =
  | { added: Shown }
  | { id: string; done: boolean }
  | { id: string; deleted: true };

function applyChange(todos: Shown[], change: Change): Shown[] {
  if ("added" in change) return insertAdded(todos, change.added);
  if ("deleted" in change) return todos.filter((todo) => todo.id !== change.id);
  return todos.map((todo) =>
    todo.id === change.id ? { ...todo, done: change.done } : todo,
  );
}

/** Puts a new todo where the server will: among the open ones by due date, undated last, newest last. */
function insertAdded(todos: Shown[], added: Shown): Shown[] {
  const at = todos.findIndex(
    (todo) =>
      todo.done ||
      (added.dueDate !== null &&
        (todo.dueDate === null || todo.dueDate > added.dueDate)),
  );
  return at === -1
    ? [...todos, added]
    : [...todos.slice(0, at), added, ...todos.slice(at)];
}

/** Runs a Server Action and turns its result, or a failed request, into a message or null. */
async function attempt(action: () => Promise<TodoActionResult>) {
  try {
    const { error } = await action();
    return error && messages[error];
  } catch {
    return unreachable;
  }
}

/**
 * The user's list next to the chat: add, check off, reopen and delete, through the Server
 * Actions in todo-actions.ts. Changes show at once (`useOptimistic`); each action refreshes
 * the page, which brings the server's list back. Lissie's changes arrive the same way, by
 * `router.refresh()` in lissie-chat.tsx.
 *
 * `today` is the server's UTC date, the same one Lissie reads due dates against.
 */
export function TodoList({ todos, today }: { todos: Todo[]; today: string }) {
  const [shown, change] = useOptimistic<Shown[], Change>(todos, applyChange);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  // Todos just checked off on this page: they stay in the open list while their claw marks
  // are drawn (see rakeHoldMs), then move to Done.
  const [raking, setRaking] = useState<ReadonlySet<string>>(new Set());
  const titleRef = useRef<HTMLInputElement>(null);

  function rake(id: string, on: boolean) {
    setRaking((ids) => {
      const next = new Set(ids);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function run(
    todo: Todo,
    next: Change,
    action: () => Promise<TodoActionResult>,
  ) {
    if ("done" in next) {
      // With reduced motion there is nothing to watch, so it moves at once.
      const holds =
        next.done && !matchMedia("(prefers-reduced-motion: reduce)").matches;
      rake(todo.id, holds);
      if (holds) setTimeout(() => rake(todo.id, false), rakeHoldMs);
    }
    startTransition(async () => {
      change(next);
      const failed = await attempt(action);
      // Say which todo the optimistic change was taken back on, unless it is simply gone.
      setError(
        failed && failed !== messages["todo-not-found"]
          ? `“${todo.title}” is back as it was. ${failed}`
          : failed,
      );
    });
  }

  const open = shown.filter((todo) => !todo.done || raking.has(todo.id));
  const done = shown.filter((todo) => todo.done && !raking.has(todo.id));
  const openCount = shown.filter((todo) => !todo.done).length;
  const focus = useFocusFollowsList(open, done, titleRef);

  const rowProps = (todo: Shown) => ({
    todo,
    today,
    swipe: raking.has(todo.id),
    checkboxRef: focus.register(todo.id),
    onDoneChange: (isDone: boolean) =>
      run(todo, { id: todo.id, done: isDone }, () =>
        setTodoDoneAction({ id: todo.id, done: isDone }),
      ),
    onDelete: () =>
      run(todo, { id: todo.id, deleted: true }, () =>
        deleteTodoAction({ id: todo.id }),
      ),
  });

  return (
    <section
      ref={focus.sectionRef}
      aria-labelledby="todo-list-heading"
      className="flex flex-col"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2
          id="todo-list-heading"
          className="font-display text-4xl leading-none font-bold"
        >
          Your list
        </h2>
        {/* On a phone the List switch above already shows the count. */}
        {openCount > 0 && (
          <p className="hidden text-sm text-ink-soft lg:block">
            {openCount} to do
          </p>
        )}
      </div>
      <AddTodoForm
        titleRef={titleRef}
        onAdding={(todo) => change({ added: todo })}
        onResult={(failed, title) => {
          setError(failed);
          setStatus(failed ? "" : `Added “${title}”.`);
        }}
      />
      <p role="status" className="sr-only">
        {status}
      </p>
      {error && (
        <div className="mt-3">
          <FormError>{error}</FormError>
        </div>
      )}
      {open.length > 0 ? (
        <ul aria-label="To do" className="mt-4 divide-y divide-line/70">
          {open.map((todo) => (
            <TodoRow key={todo.id} {...rowProps(todo)} />
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-pretty text-ink-soft">
          {done.length > 0
            ? "Nothing open. Lissie is almost impressed."
            : "Nothing on your list yet. Lissie finds that suspicious. Add a todo above, or tell her."}
        </p>
      )}
      {done.length > 0 && (
        <>
          <h3 className="mt-8 text-sm font-semibold text-ink-soft">Done</h3>
          <ul aria-label="Done" className="mt-1 divide-y divide-line/70">
            {done.map((todo) => (
              <TodoRow key={todo.id} {...rowProps(todo)} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/**
 * Keeps keyboard focus in the list when the row holding it leaves its list: checked off,
 * reopened or deleted. Focus goes to the row that takes its place (the next one, else the
 * one before), else to the todo in its new list, else to the new-todo input.
 */
function useFocusFollowsList(
  open: Shown[],
  done: Shown[],
  titleRef: RefObject<HTMLInputElement | null>,
) {
  const sectionRef = useRef<HTMLElement>(null);
  const checkboxes = useRef(new Map<string, HTMLInputElement>());
  const focusedId = useRef<string | null>(null);
  const rendered = useRef({ open: [] as string[], done: [] as string[] });

  useEffect(() => {
    const section = sectionRef.current;
    const track = (event: FocusEvent) => {
      const row = (event.target as Element).closest<HTMLElement>(
        "[data-todo-id]",
      );
      focusedId.current = row?.dataset.todoId ?? null;
    };
    section?.addEventListener("focusin", track);
    return () => section?.removeEventListener("focusin", track);
  }, []);

  useLayoutEffect(() => {
    const was = rendered.current;
    const now = {
      open: open.map((todo) => todo.id),
      done: done.map((todo) => todo.id),
    };
    rendered.current = now;
    // A checkbox still on the page and usable; a todo being added has a disabled one.
    const live = (todoId: string) => {
      const input = checkboxes.current.get(todoId);
      if (!input?.isConnected) checkboxes.current.delete(todoId);
      else if (!input.disabled) return input;
    };

    const id = focusedId.current;
    const active = document.activeElement;
    if (!id || (active && active !== document.body)) return;
    const from = was.open.includes(id)
      ? "open"
      : was.done.includes(id)
        ? "done"
        : null;
    if (!from || now[from].includes(id)) return;

    const at = was[from].indexOf(id);
    const neighbors = [
      ...was[from].slice(at + 1),
      ...was[from].slice(0, at).reverse(),
    ];
    const target =
      neighbors
        .filter((other) => now[from].includes(other))
        .map(live)
        .find(Boolean) ??
      live(id) ??
      titleRef.current;
    target?.focus();
  });

  return {
    sectionRef,
    // Kept by id, not cleared on unmount: a row that moves lists mounts a new checkbox.
    register: (id: string) => (input: HTMLInputElement | null) => {
      if (input) checkboxes.current.set(id, input);
    },
  };
}

let addCount = 0;

function AddTodoForm({
  titleRef,
  onAdding,
  onResult,
}: {
  titleRef: RefObject<HTMLInputElement | null>;
  onAdding: (todo: Shown) => void;
  onResult: (error: string | null, title: string) => void;
}) {
  const [pending, startAdding] = useTransition();
  const titleId = useId();
  const dueId = useId();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title"));
    const dueDate = String(data.get("dueDate")) || null;
    // The form clears at once, ready for the next one, while this one shows in the list.
    form.reset();
    startAdding(async () => {
      onAdding({
        id: `adding-${++addCount}`,
        title,
        dueDate,
        done: false,
        createdAt: new Date().toISOString(),
        completedAt: null,
        pending: true,
      });
      const error = await attempt(() => addTodoAction({ title, dueDate }));
      // Nothing was added, so give the user back what they typed.
      if (error) {
        for (const [name, value] of [
          ["title", title],
          ["dueDate", dueDate ?? ""],
        ]) {
          const input = form.elements.namedItem(name);
          if (input instanceof HTMLInputElement) input.value = value;
        }
      }
      onResult(error, title);
      titleRef.current?.focus();
    });
  }

  return (
    <form onSubmit={submit} className="mt-5 flex flex-col gap-2.5">
      <label htmlFor={titleId} className="sr-only">
        New todo
      </label>
      <input
        ref={titleRef}
        id={titleId}
        name="title"
        placeholder="What needs doing?"
        autoComplete="off"
        maxLength={200}
        required
        className={`${inputClass} ${inputSizes.md}`}
      />
      <div className="flex items-center gap-2.5">
        <label htmlFor={dueId} className="text-sm font-semibold">
          Due
        </label>
        <input
          id={dueId}
          name="dueDate"
          type="date"
          className={`${inputClass} ${inputSizes.md} min-w-0 flex-1 sm:w-44 sm:flex-none`}
        />
        <Button type="submit" disabled={pending} className="ml-auto">
          {pending ? "Adding…" : "Add"}
        </Button>
      </div>
    </form>
  );
}

function TodoRow({
  todo,
  today,
  swipe,
  checkboxRef,
  onDoneChange,
  onDelete,
}: {
  todo: Shown;
  today: string;
  swipe: boolean;
  checkboxRef: (input: HTMLInputElement | null) => void;
  onDoneChange: (done: boolean) => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const checkboxId = useId();
  const deleteRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  // Focus follows the question: onto Keep when it is asked, back to the bin when it is not.
  const asked = useRef(false);
  useEffect(() => {
    if (confirming) keepRef.current?.focus();
    else if (asked.current) deleteRef.current?.focus();
    asked.current = confirming;
  }, [confirming]);

  return (
    <li
      // A todo being added scrolls into view, so the user sees where it landed.
      ref={
        todo.pending
          ? (row) => row?.scrollIntoView({ block: "nearest" })
          : undefined
      }
      data-todo-id={todo.pending ? undefined : todo.id}
      className={`group py-3 ${todo.pending ? "text-ink-soft" : ""}`}
    >
      <div className="flex items-start gap-3">
        <span className="relative mt-[0.2rem] grid size-5 shrink-0 place-items-center">
          <input
            ref={checkboxRef}
            id={checkboxId}
            type="checkbox"
            checked={todo.done}
            disabled={todo.pending}
            onChange={(event) => onDoneChange(event.target.checked)}
            className={`peer size-5 cursor-pointer appearance-none rounded-[5px] border-2 border-ink-soft bg-paper ${colorFade} checked:border-ginger checked:bg-ginger hover:border-ink checked:hover:border-ginger disabled:cursor-wait disabled:border-edge ${focusRing}`}
          />
          <svg
            viewBox="0 0 12 12"
            aria-hidden="true"
            className="pointer-events-none absolute size-3 text-fog opacity-0 peer-checked:opacity-100"
          >
            <path
              d="M2 6.5 5 9.5 10 3"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <label
            htmlFor={checkboxId}
            className={`relative isolate inline-block max-w-full cursor-pointer break-words ${todo.done ? "text-halo text-ink-soft" : ""}`}
          >
            {todo.title}
            {todo.done && <ClawMarks swipe={swipe} />}
          </label>
          {!todo.done && todo.dueDate && (
            <DueDate dueDate={todo.dueDate} today={today} />
          )}
        </div>
        {!confirming && !todo.pending && (
          <button
            ref={deleteRef}
            type="button"
            aria-label={`Delete “${todo.title}”`}
            onClick={() => setConfirming(true)}
            className={`-my-1 grid size-8 shrink-0 place-items-center rounded-md text-ink-soft transition-opacity hover:bg-ink/10 hover:text-ink pointer-coarse:-my-2.5 pointer-coarse:-mr-1.5 pointer-coarse:size-11 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100 ${focusRing}`}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4">
              <path
                d="M4 4 12 12M12 4 4 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>
      {confirming && (
        <fieldset
          onKeyDown={(event) => {
            if (event.key === "Escape") setConfirming(false);
          }}
          className="mt-2.5 ml-8 flex flex-wrap items-center gap-x-3 gap-y-2"
        >
          <legend className="sr-only">Delete “{todo.title}”?</legend>
          <p className="text-sm font-semibold">
            Delete it for good? Lissie won't bring it back.
          </p>
          <div className="flex gap-2">
            <Button variant="danger" size="sm" onClick={onDelete}>
              Delete
            </Button>
            <Button
              ref={keepRef}
              variant="secondary"
              size="sm"
              onClick={() => setConfirming(false)}
            >
              Keep
            </Button>
          </div>
        </fieldset>
      )}
    </li>
  );
}

function DueDate({ dueDate, today }: { dueDate: string; today: string }) {
  // Both are yyyy-mm-dd, so string order is date order.
  if (dueDate < today)
    return (
      <p className="mt-0.5 text-sm font-semibold text-danger">
        was due {formatDueDate(dueDate)}
      </p>
    );
  return (
    <p className="mt-0.5 text-sm text-ink-soft">
      {dueDate === today ? "due today" : `due ${formatDueDate(dueDate)}`}
    </p>
  );
}
