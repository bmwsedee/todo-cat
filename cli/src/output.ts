import type { Todo } from "@todo-cat/contract";
import type { CliError } from "./errors";

/**
 * Writes results to stdout and everything else to stderr, as readable text or, with
 * `--json`, as JSON: one document on stdout per command, one JSON line per message on stderr.
 */
export class Output {
  constructor(readonly json: boolean) {}

  result(data: unknown, text: string): void {
    process.stdout.write(
      this.json ? `${JSON.stringify(data, null, 2)}\n` : `${text}\n`,
    );
  }

  /** Something the user must see before the command finishes, such as the login code. */
  progress(data: Record<string, unknown>, text: string): void {
    process.stderr.write(this.json ? `${JSON.stringify(data)}\n` : `${text}\n`);
  }

  error({ code, message }: CliError): void {
    process.stderr.write(
      this.json
        ? `${JSON.stringify({ error: { code, message } })}\n`
        : `error (${code}): ${message}\n`,
    );
  }
}

export function todoLine(todo: Todo): string {
  const due = todo.dueDate ? `  due ${todo.dueDate}` : "";
  return `${todo.done ? "[x]" : "[ ]"} ${todo.id}  ${todo.title}${due}`;
}

export function todoDetails(todo: Todo): string {
  return [
    `${todo.done ? "[x]" : "[ ]"} ${todo.title}`,
    `id:        ${todo.id}`,
    `due:       ${todo.dueDate ?? "-"}`,
    `created:   ${todo.createdAt}`,
    `completed: ${todo.completedAt ?? "-"}`,
  ].join("\n");
}
