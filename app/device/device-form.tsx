"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Form, FormError, linkClass } from "@/components/ui/form";
import { authClient } from "@/lib/auth-client";

type Decision = "approve" | "deny";
type State = { error: string | null; userCode: string; done: Decision | null };

// Better Auth's device-flow error codes, in the words of someone holding a terminal.
const messages: Record<string, string> = {
  invalid_request:
    "That code doesn't match a login. Check it against your terminal, or run todo-cat login again.",
  expired_token: "That code expired. Run todo-cat login again for a new one.",
  access_denied: "That code belongs to a login someone else started.",
};

function messageFor(error: { error?: string; message?: string }): string {
  return (
    (error.error && messages[error.error]) ??
    error.message ??
    "Couldn't reach the server. Check your connection and try again."
  );
}

async function decide(_previous: State, formData: FormData): Promise<State> {
  const userCode = String(formData.get("userCode")).trim();
  const decision: Decision =
    formData.get("decision") === "approve" ? "approve" : "deny";
  const failed = (error: string) => ({ error, userCode, done: null });

  // Verifying while signed in claims the code for this user; only then can they decide.
  const verified = await authClient.device({ query: { user_code: userCode } });
  if (verified.error) return failed(messageFor(verified.error));
  if (verified.data.status !== "pending") {
    return failed(
      "That code was already used. Run todo-cat login again for a new one.",
    );
  }

  const { error } =
    decision === "approve"
      ? await authClient.device.approve({ userCode })
      : await authClient.device.deny({ userCode });
  if (error) return failed(messageFor(error));
  return { error: null, userCode, done: decision };
}

export function DeviceForm({ userCode }: { userCode: string }) {
  const [state, formAction, pending] = useActionState(decide, {
    error: null,
    userCode,
    done: null,
  });

  if (state.done) {
    return (
      <div className="flex flex-col gap-6">
        <p role="status" className="text-lg font-semibold">
          {state.done === "approve"
            ? "Approved. Your terminal finishes logging in within a few seconds."
            : "Denied. That terminal gets nothing."}
        </p>
        <Link href="/" className={`self-start ${linkClass}`}>
          Go to your list
        </Link>
      </div>
    );
  }

  return (
    <Form action={formAction}>
      <Field
        label="Code"
        name="userCode"
        defaultValue={state.userCode}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        required
        // Read character by character against the terminal, so it gets room and even spacing.
        size="lg"
        className="tracking-[0.18em] uppercase tabular-nums"
      />
      <FormError>{state.error}</FormError>
      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          name="decision"
          value="approve"
          disabled={pending}
        >
          {pending ? "Checking…" : "Approve"}
        </Button>
        <Button
          type="submit"
          name="decision"
          value="deny"
          variant="secondary"
          disabled={pending}
        >
          Deny
        </Button>
      </div>
    </Form>
  );
}
