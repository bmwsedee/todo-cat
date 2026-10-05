import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { FormFooter } from "@/components/ui/form";
import { PageShell } from "@/components/ui/page-shell";
import { nextPath, withNext } from "@/lib/next-path";
import { getUserId } from "@/lib/session";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create account · todo-cat" };

export default async function SignupPage({
  searchParams,
}: PageProps<"/signup">) {
  const next = nextPath((await searchParams).next);
  if (await getUserId(await headers())) redirect(next);

  return (
    <PageShell
      title="Lissie will keep your list."
      lede="She'll also remember what you didn't do. Create an account to start."
    >
      <SignupForm next={next} />
      <FormFooter href={withNext("/login", next)} linkText="Log in">
        Already have an account?
      </FormFooter>
    </PageShell>
  );
}
