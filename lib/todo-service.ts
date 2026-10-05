import "server-only";
import type {
  AddTodoInput,
  ErrorCode,
  ListTodosFilter,
  Todo,
  UpdateTodoInput,
} from "@todo-cat/contract";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { todos } from "@/lib/schema";

// Every todo query and rule; nothing else touches the `todos` table.
// Every function takes the owner's user id first and every query filters by it.
// Input is trusted to match the contract schemas; adapters validate it. See tech-docs/architecture.md.

/** A rule violation with a stable code that adapters map to their protocol. */
export class TodoError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TodoError";
  }
}

// Another user's todo is reported exactly like a missing one, so ids never leak.
function notFound(id: string) {
  return new TodoError("todo-not-found", `No todo with id ${id}`);
}

type Row = typeof todos.$inferSelect;

function toTodo(row: Row): Todo {
  return {
    id: row.id,
    title: row.title,
    dueDate: row.dueDate,
    done: row.done,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

function owned(userId: string, id: string) {
  return and(eq(todos.ownerId, userId), eq(todos.id, id));
}

/** Open todos first, then by due date (none last), then oldest first. */
export async function listTodos(
  userId: string,
  filter: ListTodosFilter = {},
): Promise<Todo[]> {
  const rows = await db
    .select()
    .from(todos)
    .where(
      and(
        eq(todos.ownerId, userId),
        filter.status === "open" ? eq(todos.done, false) : undefined,
        filter.status === "done" ? eq(todos.done, true) : undefined,
        // instr instead of like, so % and _ in the text match literally.
        filter.text
          ? sql`instr(lower(${todos.title}), lower(${filter.text})) > 0`
          : undefined,
      ),
    )
    .orderBy(
      asc(todos.done),
      sql`${todos.dueDate} is null`,
      asc(todos.dueDate),
      asc(todos.createdAt),
      asc(todos.id),
    );
  return rows.map(toTodo);
}

export async function getTodo(userId: string, id: string): Promise<Todo> {
  const [row] = await db.select().from(todos).where(owned(userId, id));
  if (!row) throw notFound(id);
  return toTodo(row);
}

/** `now` is for tests and the dev seed; adapters leave it to default. */
export async function addTodo(
  userId: string,
  input: AddTodoInput,
  now = new Date(),
): Promise<Todo> {
  const [row] = await db
    .insert(todos)
    .values({
      id: crypto.randomUUID(),
      ownerId: userId,
      title: input.title,
      dueDate: input.dueDate ?? null,
      createdAt: now,
    })
    .returning();
  return toTodo(row);
}

/**
 * Changes only the fields present. Marking a todo done sets `completedAt` to `now`
 * (kept if it was already done); reopening it clears `completedAt`.
 */
export async function updateTodo(
  userId: string,
  id: string,
  input: UpdateTodoInput,
  now = new Date(),
): Promise<Todo> {
  const changes: Partial<Row> = {};
  if (input.title !== undefined) changes.title = input.title;
  if (input.dueDate !== undefined) changes.dueDate = input.dueDate;
  if (input.done !== undefined) changes.done = input.done;
  if (Object.keys(changes).length === 0) return getTodo(userId, id);

  const [row] = await db
    .update(todos)
    .set({
      ...changes,
      ...(input.done === true && {
        completedAt: sql`coalesce(${todos.completedAt}, ${now.getTime()})`,
      }),
      ...(input.done === false && { completedAt: null }),
    })
    .where(owned(userId, id))
    .returning();
  if (!row) throw notFound(id);
  return toTodo(row);
}

export async function deleteTodo(userId: string, id: string): Promise<void> {
  const deleted = await db
    .delete(todos)
    .where(owned(userId, id))
    .returning({ id: todos.id });
  if (deleted.length === 0) throw notFound(id);
}
