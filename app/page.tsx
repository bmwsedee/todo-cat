import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/ui/page-shell";
import { db } from "@/lib/db";
import { user } from "@/lib/schema";
import { getUserId } from "@/lib/session";
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
    <PageShell
      title={`Hi, ${me.name}.`}
      lede="Your list is empty. Lissie is not impressed."
    >
      <SignOutButton />
    </PageShell>
  );
}
