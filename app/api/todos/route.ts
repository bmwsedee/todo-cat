import { addTodoInputSchema, listTodosFilterSchema } from "@todo-cat/contract";
import { addTodo, listTodos } from "@/lib/todo-service";
import { parse, parseBody, withUser } from "./rest";

/** Lists the caller's todos; `?status=open|done|all` and `?text=` filter them. */
export function GET(request: Request) {
  return withUser(request, async (userId) => {
    const query = Object.fromEntries(new URL(request.url).searchParams);
    const filter = parse(listTodosFilterSchema, query);
    return Response.json(await listTodos(userId, filter));
  });
}

export function POST(request: Request) {
  return withUser(request, async (userId) => {
    const todo = await addTodo(
      userId,
      await parseBody(request, addTodoInputSchema),
    );
    return Response.json(todo, { status: 201 });
  });
}
