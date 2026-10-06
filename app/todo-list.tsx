"use client";

import type { ErrorCode, Todo } from "@todo-cat/contract";
import {
  type FormEvent,
  startTransition,
  useEffect,
  useId,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { ClawMarks } from "@/components/claw-marks";
import { Button, focusRing } from "@/components/ui/button";
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

type Change = { id: string } & ({ done: boolean } | { deleted: true });

function applyChange(todos: Todo[], change: Change): Todo[] {
  if ("deleted" in change) return todos.filter((todo) => todo.id !== change.id);
  return todos.map((todo) =>
    todo.id === change.id ? { ...todo, done: change.done } : todo,
  );
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
  const [shown, change] = useOptimistic(todos, applyChange);
  const [error, setError] = useState<string | null>(null);
  // Todos checked off on this page, which get to see their claw marks drawn.
  const [swiped, setSwiped] = useState<ReadonlySet<string>>(new Set());

  function run(next: Change, action: () => Promise<TodoActionResult>) {
    if ("done" in next && next.done)
      setSwiped((ids) => new Set(ids).add(next.id));
    startTransition(async () => {
      change(next);
      setError(await attempt(action));
    });
  }

  const open = shown.filter((todo) => !todo.done);
  const done = shown.filter((todo) => todo.done);
  const rowProps = (todo: Todo) => ({
    todo,
    today,
    swipe: swiped.has(todo.id),
    onDoneChange: (isDone: boolean) =>
      run({ id: todo.id, done: isDone }, () =>
        setTodoDoneAction({ id: todo.id, done: isDone }),
      ),
    onDelete: () =>
      run({ id: todo.id, deleted: true }, () =>
        deleteTodoAction({ id: todo.id }),
      ),
  });

  return (
    <section aria-labelledby="todo-list-heading" className="flex flex-col">
      <div className="flex items-baseline justify-between gap-4">
        <h2
          id="todo-list-heading"
          className="font-display text-4xl leading-none font-bold"
        >
          Your list
        </h2>
        {open.length > 0 && (
          <p className="text-sm text-ink-soft">{open.length} to do</p>
        )}
      </div>
      <AddTodoForm onResult={setError} />
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
        <p className="mt-5 text-ink-soft">
          {done.length > 0
            ? "Nothing open. Lissie is almost impressed."
            : "Nothing yet. Add a todo above, or tell Lissie."}
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

function AddTodoForm({
  onResult,
}: {
  onResult: (error: string | null) => void;
}) {
  const [pending, startAdding] = useTransition();
  const titleRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const dueId = useId();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startAdding(async () => {
      const error = await attempt(() =>
        addTodoAction({
          title: String(data.get("title")),
          dueDate: String(data.get("dueDate")) || null,
        }),
      );
      onResult(error);
      if (!error) form.reset();
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
          className={`${inputClass} ${inputSizes.md} min-w-0 flex-1`}
        />
        <Button type="submit" disabled={pending}>
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
  onDoneChange,
  onDelete,
}: {
  todo: Todo;
  today: string;
  swipe: boolean;
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
    <li className="group py-3">
      <div className="flex items-start gap-3">
        <span className="relative mt-[0.2rem] grid size-5 shrink-0 place-items-center">
          <input
            id={checkboxId}
            type="checkbox"
            checked={todo.done}
            onChange={(event) => onDoneChange(event.target.checked)}
            className={`peer size-5 cursor-pointer appearance-none rounded-[5px] border-2 border-ink-soft bg-paper transition-colors checked:border-ginger checked:bg-ginger hover:border-ink checked:hover:border-ginger ${focusRing}`}
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
            className={`relative isolate inline-block max-w-full cursor-pointer break-words ${todo.done ? "text-ink-soft" : ""}`}
          >
            {todo.title}
            {todo.done && <ClawMarks swipe={swipe} />}
          </label>
          {!todo.done && todo.dueDate && (
            <DueDate dueDate={todo.dueDate} today={today} />
          )}
        </div>
        {!confirming && (
          <button
            ref={deleteRef}
            type="button"
            aria-label={`Delete “${todo.title}”`}
            onClick={() => setConfirming(true)}
            className={`-my-1 grid size-8 shrink-0 place-items-center rounded-md text-ink-soft transition-opacity hover:bg-ink/10 hover:text-ink [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100 ${focusRing}`}
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
