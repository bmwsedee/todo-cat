"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Form, FormError } from "@/components/ui/form";
import { authClient } from "@/lib/auth-client";

type State = { error: string | null; email: string };

export function LoginForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async (_previous: State, formData: FormData): Promise<State> => {
      const email = String(formData.get("email"));
      const { error } = await authClient.signIn.email({
        email,
        password: String(formData.get("password")),
      });
      if (error) {
        return {
          email,
          error:
            error.code === "INVALID_EMAIL_OR_PASSWORD"
              ? "That email and password don't match. Check both and try again."
              : (error.message ??
                "Couldn't reach the server. Check your connection and try again."),
        };
      }
      router.replace("/");
      return { email, error: null };
    },
    { error: null, email: "" },
  );

  return (
    <Form action={formAction}>
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.email}
        required
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <FormError>{state.error}</FormError>
      <Button type="submit" disabled={pending}>
        {pending ? "Logging in…" : "Log in"}
      </Button>
    </Form>
  );
}
