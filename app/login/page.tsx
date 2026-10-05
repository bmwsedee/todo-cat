import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { FormFooter } from "@/components/ui/form";
import { PageShell } from "@/components/ui/page-shell";
import { getUserId } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in · todo-cat" };

export default async function LoginPage() {
  if (await getUserId(await headers())) redirect("/");

  return (
    <PageShell
      title="Back again?"
      lede="Lissie noticed you were gone. Log in to see your list."
    >
      <LoginForm />
      <FormFooter href="/signup" linkText="Create an account">
        New here?
      </FormFooter>
    </PageShell>
  );
}
