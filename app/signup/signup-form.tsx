"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Form, FormError } from "@/components/ui/form";
import { authClient } from "@/lib/auth-client";

type State = {
  error: string | null;
  name: string;
  email: string;
  password: string;
};

const messages: Record<string, string> = {
  USER_ALREADY_EXISTS:
    "There's already an account with that email. Log in instead.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "There's already an account with that email. Log in instead.",
  PASSWORD_TOO_SHORT: "Use a password of at least 8 characters.",
  PASSWORD_TOO_LONG: "Use a password of at most 128 characters.",
  INVALID_EMAIL: "That doesn't look like an email address.",
  // The browser checks name and password length first, so this is nearly always the email.
  VALIDATION_ERROR: "That doesn't look like an email address.",
};

/** Signs up, then goes to `next` (a same-site path, see lib/next-path.ts). */
export function SignupForm({ next }: { next: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async (_previous: State, formData: FormData): Promise<State> => {
      const name = String(formData.get("name"));
      const email = String(formData.get("email"));
      const password = String(formData.get("password"));
      const { error } = await authClient.signUp.email({
        name,
        email,
        password,
      });
      if (error) {
        // The password comes back too, so fixing the email doesn't mean typing it again.
        // Better Auth's own message is written for developers, so it is never shown.
        return {
          name,
          email,
          password,
          error:
            (error.code && messages[error.code]) ??
            "Couldn't create your account just now. Try again in a moment.",
        };
      }
      // Sign-up also signs in, so the session cookie is already set.
      router.replace(next);
      return { name, email, password: "", error: null };
    },
    { error: null, name: "", email: "", password: "" },
  );

  return (
    <Form action={formAction}>
      <Field
        label="Name"
        name="name"
        autoComplete="name"
        defaultValue={state.name}
        required
      />
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
        hint="At least 8 characters."
        name="password"
        type="password"
        autoComplete="new-password"
        defaultValue={state.password}
        minLength={8}
        maxLength={128}
        required
      />
      <FormError>{state.error}</FormError>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </Form>
  );
}
