import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { lissieThreadId } from "@/lib/lissie/thread";
import { user } from "@/lib/schema";
import { getUserId } from "@/lib/session";
import { listTodos } from "@/lib/todo-service";
import { LissieChat, LissieProvider, WatchingEyes } from "./lissie-chat";
import { SignOutButton } from "./sign-out-button";
import { TodoSidebar } from "./todo-sidebar";

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
      <div className="mx-auto flex h-dvh w-full max-w-6xl flex-col px-6 lg:px-10">
        <header className="flex items-center gap-4 border-b-2 border-line py-5">
          <WatchingEyes className="h-7 w-auto shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-3xl leading-none font-extrabold tracking-tight [font-stretch:80%]">
              Hi, {me.name}.
            </h1>
            <p className="mt-1 text-ink-soft">
              Tell Lissie what needs doing. She'll pretend not to care.
            </p>
          </div>
          <SignOutButton />
        </header>
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:gap-10">
          {/* Above the chat on a phone, kept short so the chat keeps the screen; beside it on a desktop. */}
          <TodoSidebar
            todos={todos}
            className="max-h-[30dvh] shrink-0 overflow-y-auto border-b-2 border-line py-4 lg:order-last lg:max-h-none lg:w-72 lg:border-b-0 lg:border-l-2 lg:py-6 lg:pl-8"
          />
          <main className="min-h-0 max-w-2xl flex-1">
            <LissieChat threadId={lissieThreadId(userId)} />
          </main>
        </div>
      </div>
    </LissieProvider>
  );
}
