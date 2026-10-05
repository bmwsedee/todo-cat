import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { FormFooter } from "@/components/ui/form";
import { PageShell } from "@/components/ui/page-shell";
import { nextPath, withNext } from "@/lib/next-path";
import { getUserId } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in · todo-cat" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = nextPath((await searchParams).next);
  if (await getUserId(await headers())) redirect(next);

  return (
    <PageShell
      title="Back again?"
      lede="Lissie noticed you were gone. Log in to see your list."
    >
      <LoginForm next={next} />
      <FormFooter href={withNext("/signup", next)} linkText="Create an account">
        New here?
      </FormFooter>
    </PageShell>
  );
}
