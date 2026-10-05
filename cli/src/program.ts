import { Command, CommanderError } from "commander";
import packageJson from "../package.json" with { type: "json" };
import { addAuthCommands } from "./auth-commands";
import { examples } from "./command";
import { credentialsPath, DEFAULT_SERVER_URL } from "./config";
import { CliError, errorCodes, exitCodesHelp } from "./errors";
import { Output } from "./output";
import { addTodoCommands } from "./todo-commands";

// The todo-cat CLI: a client of the REST API, written for AI agents first and humans
// second. See tech-docs/cli.md.

function createProgram(): Command {
  const program = new Command()
    .name("todo-cat")
    .description(
      "Lissie's to-do list from the terminal: a client of the todo-cat server's REST API.",
    )
    .version(packageJson.version)
    .option(
      "--json",
      "print the result as JSON on stdout, and errors as JSON on stderr",
    )
    // Usage errors go through `run` like every other error, so they get a code and --json.
    .exitOverride()
    .configureOutput({ outputError: () => {} })
    .addHelpText(
      "after",
      () => `${examples(
        "todo-cat login",
        'todo-cat add "Buy tuna" --due 2026-10-12',
        "todo-cat list",
        "todo-cat list --status all --json",
        "todo-cat done <id>",
        "todo-cat delete <id> --yes",
      )}

Output:
  Results go to stdout; errors go to stderr as "error (<code>): <message>",
  or with --json as {"error":{"code":"<code>","message":"<message>"}}.
  The CLI never prompts; a command that needs confirmation takes --yes.

Environment:
  TODO_CAT_URL         the server to talk to (default ${DEFAULT_SERVER_URL})
  TODO_CAT_CONFIG_DIR  where the login is kept (now ${credentialsPath()})

${exitCodesHelp()}`,
    );

  addAuthCommands(program);
  addTodoCommands(program);
  return program;
}

/** Runs the CLI on `argv` (as in `process.argv`) and returns the exit code. */
export async function run(argv: string[]): Promise<number> {
  // Decided before parsing, so even a usage error comes out as JSON.
  const out = new Output(argv.includes("--json"));
  try {
    await createProgram().parseAsync(argv);
    return 0;
  } catch (error) {
    const cliError = toCliError(error);
    if (typeof cliError === "number") return cliError;
    out.error(cliError);
    return cliError.exitCode;
  }
}

function toCliError(error: unknown): CliError | number {
  if (error instanceof CliError) return error;
  if (error instanceof CommanderError) {
    // Help or the version is printed already: asked for (exit code 0), or the help
    // because no command was given (commander's exit code 1, a usage error for us).
    if (
      error.code.startsWith("commander.help") ||
      error.code === "commander.version"
    ) {
      return error.exitCode === 0 ? 0 : errorCodes["usage-error"].exit;
    }
    const message = error.message.replace(/^error: /, "").replace(/\n/g, " ");
    return new CliError("usage-error", `${message} See: todo-cat --help`);
  }
  return new CliError(
    "unexpected-error",
    error instanceof Error ? error.message : String(error),
  );
}
