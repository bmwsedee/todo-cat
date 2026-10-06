"use server";

import { addTodoInputSchema, type ErrorCode } from "@todo-cat/contract";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { type ZodType, z } from "zod";
import { getUserId } from "@/lib/session";
import { addTodo, deleteTodo, TodoError, updateTodo } from "@/lib/todo-service";

// The browser adapter on the todo service: the list on / calls these Server Actions. Like
// REST, each resolves the user, parses its input with a contract schema, calls the service
// and maps errors; no business rules here. See tech-docs/architecture.md.

/** `error` is null on success; otherwise the contract's code for what went wrong. */
export type TodoActionResult = { error: ErrorCode | null };

const todoId = z.string().min(1);
const setTodoDoneInput = z.strictObject({ id: todoId, done: z.boolean() });
const deleteTodoInput = z.strictObject({ id: todoId });

/**
 * Runs `call` for the signed-in user with `input` parsed by `schema`. Refreshes the page
 * afterwards, also for `todo-not-found`, so a list that was out of date catches up.
 */
async function act<T>(
  schema: ZodType<T>,
  input: unknown,
  call: (userId: string, data: T) => Promise<unknown>,
): Promise<TodoActionResult> {
  const userId = await getUserId(await headers());
  if (!userId) return { error: "unauthorized" };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "validation-failed" };
  try {
    await call(userId, parsed.data);
    return { error: null };
  } catch (error) {
    if (error instanceof TodoError) return { error: error.code };
    throw error;
  } finally {
    refresh();
  }
}

// Inputs are `unknown`: anyone can POST to a Server Action, whatever its TypeScript type says.

/** `{ title, dueDate? }`, the contract's add input. */
export async function addTodoAction(input: unknown) {
  return act(addTodoInputSchema, input, (userId, data) =>
    addTodo(userId, data),
  );
}

/** `{ id, done }`: checks a todo off, or opens it again. */
export async function setTodoDoneAction(input: unknown) {
  return act(setTodoDoneInput, input, (userId, { id, done }) =>
    updateTodo(userId, id, { done }),
  );
}

/** `{ id }`. */
export async function deleteTodoAction(input: unknown) {
  return act(deleteTodoInput, input, (userId, { id }) =>
    deleteTodo(userId, id),
  );
}
