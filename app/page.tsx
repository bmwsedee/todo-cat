import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { lissieThreadId } from "@/lib/lissie/thread";
import { user } from "@/lib/schema";
import { getUserId } from "@/lib/session";
import { LissieChat, LissieProvider, WatchingEyes } from "./lissie-chat";
import { SignOutButton } from "./sign-out-button";

export default async function Home() {
  const userId = await getUserId(await headers());
  if (!userId) redirect("/login");

  const [me] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, userId));
  if (!me) redirect("/login");

  return (
    <LissieProvider>
      <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col px-6 sm:ml-[12vw]">
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
        <main className="min-h-0 flex-1">
          <LissieChat threadId={lissieThreadId(userId)} />
        </main>
      </div>
    </LissieProvider>
  );
}
