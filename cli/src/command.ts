import type { Command } from "commander";
import { serverUrl } from "./config";
import { Output } from "./output";

/** What every command needs: the server it talks to and where its output goes. */
export type Context = { server: string; out: Output };

/**
 * Adapts a command handler for commander: builds the context from the global options and
 * drops commander's trailing options and command arguments, which handlers read themselves.
 */
export function action<Args extends unknown[]>(
  handler: (context: Context, ...args: Args) => Promise<void>,
) {
  return async (...args: unknown[]) => {
    const command = args.at(-1) as Command;
    const { json } = command.optsWithGlobals<{ json?: boolean }>();
    await handler(
      { server: serverUrl(), out: new Output(Boolean(json)) },
      ...(args.slice(0, -1) as Args),
    );
  };
}

/** The examples section every command's help ends with. */
export function examples(...lines: string[]): string {
  return `\nExamples:\n${lines.map((line) => `  $ ${line}`).join("\n")}`;
}
