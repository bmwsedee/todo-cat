import {
  addTodoInputSchema,
  errorBodySchema,
  listTodosFilterSchema,
  todoListSchema,
  todoSchema,
} from "@todo-cat/contract";
import { z } from "zod";

// The shapes of Lissie's tools, shared by the tools (lib/lissie/tools.ts) and the chat, which
// renders each call from its arguments and result. No user id anywhere: the tools take it
// from the request context, and the strict input schemas reject one the model makes up.

export const listTodosToolInput = listTodosFilterSchema;
export const listTodosToolOutput = z.object({ todos: todoListSchema });

export const addTodoToolInput = addTodoInputSchema;
export const addTodoToolOutput = todoSchema;

export const setTodoDoneToolInput = z.strictObject({
  id: z.string().min(1).describe("The todo's id, as listTodos returns it"),
  done: z.boolean().describe("true marks it done, false opens it again"),
});
// Another user's todo is not found, exactly like a missing one.
export const setTodoDoneToolOutput = z.union([todoSchema, errorBodySchema]);

/** The tools that change the list; the sidebar reloads when one of them returns. */
export const LIST_CHANGING_TOOLS: ReadonlySet<string> = new Set([
  "addTodo",
  "setTodoDone",
]);
