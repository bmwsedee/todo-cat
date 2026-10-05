import type { ErrorCode } from "@todo-cat/contract";

// Every error the CLI reports: the API's error codes plus a few of its own, each with its
// exit code. `--help` lists this table, so it is the one place to change either.

export const errorCodes = {
  "unexpected-error": {
    exit: 1,
    meaning: "the server failed or answered outside the contract",
  },
  "usage-error": {
    exit: 2,
    meaning: "unknown command, bad option or argument, delete without --yes",
  },
  unauthorized: {
    exit: 3,
    meaning: "not logged in, or the session expired or was revoked",
  },
  "login-denied": { exit: 3, meaning: "the login was denied in the browser" },
  "login-expired": {
    exit: 3,
    meaning: "the login code expired before anyone approved it",
  },
  "todo-not-found": { exit: 4, meaning: "you have no todo with that id" },
  "validation-failed": {
    exit: 5,
    meaning: "the input breaks the contract (empty title, bad date)",
  },
  "server-unreachable": {
    exit: 6,
    meaning: "no todo-cat server answers at TODO_CAT_URL",
  },
} as const satisfies Record<ErrorCode, unknown> &
  Record<string, { exit: number; meaning: string }>;

export type CliErrorCode = keyof typeof errorCodes;

/** An error to report on stderr with its code; the exit code follows from the code. */
export class CliError extends Error {
  constructor(
    readonly code: CliErrorCode,
    message: string,
  ) {
    super(message);
  }

  get exitCode(): number {
    return errorCodes[this.code].exit;
  }
}

/** The help section listing every exit code with the error codes that produce it. */
export function exitCodesHelp(): string {
  const lines = ["Exit codes:", "  0  success"];
  for (const [code, { exit, meaning }] of Object.entries(errorCodes)) {
    lines.push(`  ${exit}  ${code}: ${meaning}`);
  }
  return lines.join("\n");
}
