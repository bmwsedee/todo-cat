import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { today } from "@/lib/due-date";
import { lissieThreadId } from "@/lib/lissie/thread";
import { user } from "@/lib/schema";
import { getUserId } from "@/lib/session";
import { listTodos } from "@/lib/todo-service";
import { HomePanes } from "./home-panes";
import { LissieChat, LissieProvider, WatchingEyes } from "./lissie-chat";
import { SignOutButton } from "./sign-out-button";
import { TodoList } from "./todo-list";

export default async function Home() {
  const userId = await getUserId(await headers());
  if (!userId) redirect("/login");

  const [me] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, userId));
  if (!me) redirect("/login");
  const todos = await listTodos(userId);

  return (
    <LissieProvider>
      <div className="mx-auto flex h-dvh w-full max-w-7xl flex-col px-4 sm:px-6 lg:px-10">
        <header className="flex items-center gap-3 border-b-2 border-line py-4 sm:gap-5 lg:py-6">
          <WatchingEyes className="h-6 w-auto shrink-0 sm:h-8" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-3xl leading-none font-bold sm:text-5xl">
              Hi, {me.name}.
            </h1>
            <p className="mt-1.5 hidden text-ink-soft sm:block">
              Tell Lissie what needs doing. She'll pretend not to care.
            </p>
          </div>
          <SignOutButton />
        </header>
        <HomePanes
          openCount={todos.filter((todo) => !todo.done).length}
          list={<TodoList todos={todos} today={today()} />}
          chat={<LissieChat threadId={lissieThreadId(userId)} />}
        />
      </div>
    </LissieProvider>
  );
}
