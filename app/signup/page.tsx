import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { FormFooter } from "@/components/ui/form";
import { PageShell } from "@/components/ui/page-shell";
import { getUserId } from "@/lib/session";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create account · todo-cat" };

export default async function SignupPage() {
  if (await getUserId(await headers())) redirect("/");

  return (
    <PageShell
      title="Lissie will keep your list."
      lede="She'll also remember what you didn't do. Create an account to start."
    >
      <SignupForm />
      <FormFooter href="/login" linkText="Log in">
        Already have an account?
      </FormFooter>
    </PageShell>
  );
}
