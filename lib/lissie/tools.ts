import "server-only";
import { RequestContext } from "@mastra/core/request-context";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { progressCard } from "@/lib/lissie/progress-card";
import {
  addTodoToolInput,
  addTodoToolOutput,
  listTodosToolInput,
  listTodosToolOutput,
  setTodoDoneToolInput,
  setTodoDoneToolOutput,
  showProgressToolInput,
  showProgressToolOutput,
} from "@/lib/lissie/tool-schemas";
import { addTodo, listTodos, TodoError, updateTodo } from "@/lib/todo-service";

// Lissie's tools: the agent adapter on the todo service (tech-docs/architecture.md).
// The owner is the signed-in user, which the CopilotKit runtime resolves from the session
// and puts in Mastra's request context; it is never a tool argument the model fills in.

export const lissieRequestContextSchema = z.object({
  userId: z.string().min(1),
});
/**
 * The request context for one of the user's runs; the only way a user id reaches a tool.
 * Untyped, because the AG-UI bridge adds its own `ag-ui` key; the schema above checks ours.
 */
export function lissieRequestContext(userId: string): RequestContext {
  const context = new RequestContext();
  context.set("userId", userId);
  return context;
}

export const listTodosTool = createTool({
  id: "listTodos",
  description:
    "Lists your human's todos with their ids: open first, then by due date. Filter by status (open, done, all; default all) and by a case-insensitive piece of the title.",
  inputSchema: listTodosToolInput,
  outputSchema: listTodosToolOutput,
  requestContextSchema: lissieRequestContextSchema,
  execute: async (filter, { requestContext }) => ({
    todos: await listTodos(requestContext.get("userId"), filter),
  }),
});

export const addTodoTool = createTool({
  id: "addTodo",
  description:
    "Adds one todo to your human's list. dueDate is an optional calendar date, yyyy-mm-dd.",
  inputSchema: addTodoToolInput,
  outputSchema: addTodoToolOutput,
  requestContextSchema: lissieRequestContextSchema,
  execute: (input, { requestContext }) =>
    addTodo(requestContext.get("userId"), input),
});

export const setTodoDoneTool = createTool({
  id: "setTodoDone",
  description:
    "Marks one of your human's todos done, or open again. Takes the id from listTodos; never guess one.",
  inputSchema: setTodoDoneToolInput,
  outputSchema: setTodoDoneToolOutput,
  requestContextSchema: lissieRequestContextSchema,
  execute: async ({ id, done }, { requestContext }) => {
    try {
      return await updateTodo(requestContext.get("userId"), id, { done });
    } catch (error) {
      // The model gets the contract's error body, so it can say what went wrong.
      if (error instanceof TodoError)
        return { error: { code: error.code, message: error.message } };
      throw error;
    }
  },
});

export const showProgressTool = createTool({
  id: "showProgress",
  description:
    "Shows your human a card in the chat with how much of their list is done and how much is still open. Takes no input: the numbers come from the list.",
  inputSchema: showProgressToolInput,
  outputSchema: showProgressToolOutput,
  requestContextSchema: lissieRequestContextSchema,
  // Counted here, never by the model; the card is A2UI the chat renders without another model call.
  execute: async (_input, { requestContext }) => {
    const todos = await listTodos(requestContext.get("userId"));
    const done = todos.filter((todo) => todo.done).length;
    return progressCard({
      total: todos.length,
      done,
      open: todos.length - done,
    });
  },
});

// The record keys are the tool names the model and the chat see.
export const lissieTools = {
  listTodos: listTodosTool,
  addTodo: addTodoTool,
  setTodoDone: setTodoDoneTool,
  showProgress: showProgressTool,
};
