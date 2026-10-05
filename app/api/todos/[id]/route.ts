import { updateTodoInputSchema } from "@todo-cat/contract";
import { deleteTodo, getTodo, updateTodo } from "@/lib/todo-service";
import { parseBody, withUser } from "../rest";

type Context = RouteContext<"/api/todos/[id]">;

export function GET(request: Request, { params }: Context) {
  return withUser(request, async (userId) => {
    const { id } = await params;
    return Response.json(await getTodo(userId, id));
  });
}

/** Changes only the fields present; `{ "done": true }` marks the todo done. */
export function PATCH(request: Request, { params }: Context) {
  return withUser(request, async (userId) => {
    const { id } = await params;
    const input = await parseBody(request, updateTodoInputSchema);
    return Response.json(await updateTodo(userId, id, input));
  });
}

export function DELETE(request: Request, { params }: Context) {
  return withUser(request, async (userId) => {
    const { id } = await params;
    await deleteTodo(userId, id);
    return new Response(null, { status: 204 });
  });
}
