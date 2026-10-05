import {
  addTodoInputSchema,
  listTodosFilterSchema,
  type TodoStatus,
  todoStatusSchema,
  type UpdateTodoInput,
  updateTodoInputSchema,
} from "@todo-cat/contract";
import { type Command, Option } from "commander";
import { notLoggedIn, parseInput, TodoApi } from "./api";
import { action, examples } from "./command";
import { readToken } from "./config";
import { CliError } from "./errors";
import { todoDetails, todoLine } from "./output";

// One command per REST use case (see tech-docs/rest-api.md). Input goes through the
// contract schemas before it is sent; output is the contract's todo, as text or JSON.

async function todoApi(server: string): Promise<TodoApi> {
  const token = await readToken(server);
  if (!token) throw notLoggedIn(server);
  return new TodoApi(server, token);
}

const emptyList: Record<TodoStatus, string> = {
  open: "No open todos. Lissie is suspicious.",
  done: "No done todos yet.",
  all: "No todos at all.",
};

export function addTodoCommands(program: Command): void {
  program
    .command("list")
    .description("List your todos: open first, then by due date")
    .addOption(
      new Option("--status <status>", "which todos to list")
        .choices(todoStatusSchema.options)
        .default("open"),
    )
    .option("--text <text>", "only titles that contain this text, any case")
    .addHelpText(
      "after",
      examples(
        "todo-cat list",
        "todo-cat list --status all --json",
        "todo-cat list --text tuna",
      ),
    )
    .action(
      action(async ({ server, out }, options: object) => {
        const filter = parseInput(listTodosFilterSchema, { ...options });
        const todos = await (await todoApi(server)).list(filter);
        out.result(
          todos,
          todos.length
            ? todos.map(todoLine).join("\n")
            : emptyList[filter.status ?? "all"],
        );
      }),
    );

  program
    .command("show")
    .description("Show one todo")
    .argument("<id>", "the todo's id, as printed by list")
    .addHelpText("after", examples("todo-cat show <id> --json"))
    .action(
      action(async ({ server, out }, id: string) => {
        const todo = await (await todoApi(server)).get(id);
        out.result(todo, todoDetails(todo));
      }),
    );

  program
    .command("add")
    .description("Add a todo")
    .argument("<title>", "what to do; quote it when it has spaces")
    .option("--due <date>", "due date as yyyy-mm-dd")
    .addHelpText(
      "after",
      examples(
        'todo-cat add "Buy tuna"',
        'todo-cat add "Book the vet" --due 2026-10-12 --json',
      ),
    )
    .action(
      action(
        async ({ server, out }, title: string, options: { due?: string }) => {
          const input = parseInput(addTodoInputSchema, {
            title,
            dueDate: options.due,
          });
          const todo = await (await todoApi(server)).add(input);
          out.result(todo, `Added: ${todoLine(todo)}`);
        },
      ),
    );

  program
    .command("edit")
    .description("Change a todo's title or due date")
    .argument("<id>", "the todo's id, as printed by list")
    .option("--title <title>", "the new title")
    .option("--due <date>", "the new due date as yyyy-mm-dd")
    .option("--no-due", "remove the due date")
    .addHelpText(
      "after",
      examples(
        'todo-cat edit <id> --title "Buy salmon"',
        "todo-cat edit <id> --due 2026-10-20",
        "todo-cat edit <id> --no-due",
      ),
    )
    .action(
      action(
        async (
          { server, out },
          id: string,
          options: { title?: string; due?: string | false },
        ) => {
          const changes: UpdateTodoInput = {};
          if (options.title !== undefined) changes.title = options.title;
          if (options.due !== undefined) {
            changes.dueDate = options.due === false ? null : options.due;
          }
          if (Object.keys(changes).length === 0) {
            throw new CliError(
              "usage-error",
              "Nothing to change: pass --title, --due or --no-due.",
            );
          }
          const input = parseInput(updateTodoInputSchema, changes);
          const todo = await (await todoApi(server)).update(id, input);
          out.result(todo, `Changed: ${todoLine(todo)}`);
        },
      ),
    );

  program
    .command("done")
    .description("Mark a todo done")
    .argument("<id>", "the todo's id, as printed by list")
    .addHelpText("after", examples("todo-cat done <id>"))
    .action(
      action(async ({ server, out }, id: string) => {
        const todo = await (await todoApi(server)).update(id, { done: true });
        out.result(todo, `Done: ${todoLine(todo)}`);
      }),
    );

  program
    .command("reopen")
    .description("Mark a done todo open again")
    .argument("<id>", "the todo's id, as printed by list")
    .addHelpText("after", examples("todo-cat reopen <id>"))
    .action(
      action(async ({ server, out }, id: string) => {
        const todo = await (await todoApi(server)).update(id, { done: false });
        out.result(todo, `Reopened: ${todoLine(todo)}`);
      }),
    );

  program
    .command("delete")
    .description("Delete a todo for good; needs --yes")
    .argument("<id>", "the todo's id, as printed by list")
    .option("-y, --yes", "confirm; the CLI never asks")
    .addHelpText("after", examples("todo-cat delete <id> --yes"))
    .action(
      action(
        async ({ server, out }, id: string, options: { yes?: boolean }) => {
          if (!options.yes) {
            throw new CliError(
              "usage-error",
              "Deleting cannot be undone; pass --yes to confirm.",
            );
          }
          await (await todoApi(server)).delete(id);
          out.result({ id, deleted: true }, `Deleted ${id}.`);
        },
      ),
    );
}
