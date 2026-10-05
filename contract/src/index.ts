import { z } from "zod";

// The shapes the server and its clients agree on. Validation happens here, at the adapter
// boundary; the todo service trusts these types. See tech-docs/architecture.md.

/** A calendar date without time, `yyyy-mm-dd`; never converted to a `Date`. */
export const dueDateSchema = z.iso.date();

export const todoTitleSchema = z.string().trim().min(1).max(200);

export const todoSchema = z.object({
  id: z.string(),
  title: z.string(),
  dueDate: dueDateSchema.nullable(),
  done: z.boolean(),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
});
export type Todo = z.infer<typeof todoSchema>;

/** The body of `GET /api/todos`, in the service's list order. */
export const todoListSchema = z.array(todoSchema);

export const todoStatusSchema = z.enum(["open", "done", "all"]);
export type TodoStatus = z.infer<typeof todoStatusSchema>;

/** Both fields optional: no status means all, no text means no text filter. */
export const listTodosFilterSchema = z.strictObject({
  status: todoStatusSchema.optional(),
  // Case-insensitive substring of the title; blank counts as no filter.
  text: z
    .string()
    .trim()
    .transform((text) => text || undefined)
    .optional(),
});
export type ListTodosFilter = z.infer<typeof listTodosFilterSchema>;

export const addTodoInputSchema = z.strictObject({
  title: todoTitleSchema,
  dueDate: dueDateSchema.nullable().optional(),
});
export type AddTodoInput = z.infer<typeof addTodoInputSchema>;

/** Only the fields present change; `dueDate: null` clears the due date. */
export const updateTodoInputSchema = z.strictObject({
  title: todoTitleSchema.optional(),
  dueDate: dueDateSchema.nullable().optional(),
  done: z.boolean().optional(),
});
export type UpdateTodoInput = z.infer<typeof updateTodoInputSchema>;

export const errorCodeSchema = z.enum([
  "unauthorized",
  "todo-not-found",
  "validation-failed",
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

/** The body of every error response. */
export const errorBodySchema = z.object({
  error: z.object({ code: errorCodeSchema, message: z.string() }),
});
export type ErrorBody = z.infer<typeof errorBodySchema>;

/** The client id the todo-cat CLI sends to start a device login; the server accepts no other. */
export const CLI_CLIENT_ID = "todo-cat-cli";

/** A device-login code as the CLI and the /device page show it, `ABCD-EFGH`; the server ignores the dash. */
export function formatUserCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}
