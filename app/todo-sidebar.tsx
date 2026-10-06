import type { Todo } from "@todo-cat/contract";
import { formatDueDate } from "@/lib/due-date";

/**
 * The user's todos next to the chat, open then done, in the service's order. Read-only:
 * Lissie is the browser's only way to change the list, and the page re-renders this when
 * she does (see `useRefreshOnListChange` in lissie-chat.tsx).
 */
export function TodoSidebar({
  todos,
  className = "",
}: {
  todos: Todo[];
  className?: string;
}) {
  const open = todos.filter((todo) => !todo.done);
  const done = todos.filter((todo) => todo.done);

  return (
    <aside aria-labelledby="todo-sidebar-heading" className={className}>
      <h2
        id="todo-sidebar-heading"
        className="text-xl font-extrabold tracking-tight [font-stretch:80%]"
      >
        Your list
      </h2>
      {open.length > 0 ? (
        <ul aria-label="Open" className="mt-3 flex flex-col gap-2">
          {open.map((todo) => (
            <li key={todo.id} className="flex gap-2.5">
              <span
                aria-hidden="true"
                className="mt-[0.3em] size-3 shrink-0 rounded-full border-2 border-ink-soft"
              />
              <span className="min-w-0 break-words">
                {todo.title}
                {todo.dueDate && (
                  <span className="block text-sm text-ink-soft">
                    due {formatDueDate(todo.dueDate)}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-ink-soft">
          {done.length > 0
            ? "Nothing open. Lissie is almost impressed."
            : "Nothing yet. Tell Lissie what needs doing."}
        </p>
      )}
      {done.length > 0 && (
        <>
          <h3 className="mt-6 text-sm font-semibold text-ink-soft">Done</h3>
          <ul aria-label="Done" className="mt-2 flex flex-col gap-2">
            {done.map((todo) => (
              <li key={todo.id} className="flex gap-2.5 text-ink-soft">
                <svg
                  viewBox="0 0 12 12"
                  aria-hidden="true"
                  className="mt-[0.3em] size-3 shrink-0"
                >
                  <path
                    d="M2 6.5 5 9.5 10 3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="min-w-0 break-words line-through decoration-line">
                  {todo.title}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
