import {
  type AddTodoInput,
  errorBodySchema,
  type ListTodosFilter,
  type Todo,
  todoListSchema,
  todoSchema,
  type UpdateTodoInput,
} from "@todo-cat/contract";
import { createAuthClient } from "better-auth/client";
import { deviceAuthorizationClient } from "better-auth/client/plugins";
import type { ZodType } from "zod";
import { CliError } from "./errors";

// The CLI's only ways to the server: the REST API for todos and Better Auth's endpoints
// for login. Every todo response is parsed with its contract schema, so a server change
// that breaks the shape fails loudly here instead of printing garbage.

/** Better Auth's client for the device flow and sessions; the bearer token goes in per call. */
export function createCliAuthClient(server: string) {
  return createAuthClient({
    baseURL: server,
    plugins: [deviceAuthorizationClient()],
  });
}
export type CliAuthClient = ReturnType<typeof createCliAuthClient>;

export function bearer(token: string) {
  return { authorization: `Bearer ${token}` };
}

/** Runs a request, turning a network failure (no server, wrong URL) into `server-unreachable`. */
export async function reach<T>(server: string, send: () => Promise<T>) {
  try {
    return await send();
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError(
      "server-unreachable",
      `Cannot reach a todo-cat server at ${server} (${describe(error)}). Is it running? Set TODO_CAT_URL to use another one.`,
    );
  }
}

function describe(error: unknown): string {
  const cause = error instanceof Error ? error.cause : undefined;
  if (cause instanceof Error && "code" in cause) return String(cause.code);
  return error instanceof Error ? error.message : String(error);
}

/** Parses input with a contract schema before it is sent, so bad input fails without a round trip. */
export function parseInput<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new CliError(
    "validation-failed",
    result.error.issues
      .map(({ path, message }) =>
        path.length ? `${path.join(".")}: ${message}` : message,
      )
      .join("; "),
  );
}

/** The `/api/todos` endpoints (see tech-docs/rest-api.md) for one signed-in user. */
export class TodoApi {
  constructor(
    private readonly server: string,
    private readonly token: string,
  ) {}

  list(filter: ListTodosFilter): Promise<Todo[]> {
    const query = new URLSearchParams();
    if (filter.status) query.set("status", filter.status);
    if (filter.text) query.set("text", filter.text);
    return this.call("GET", `/api/todos?${query}`, todoListSchema);
  }

  get(id: string): Promise<Todo> {
    return this.call("GET", todoPath(id), todoSchema);
  }

  add(input: AddTodoInput): Promise<Todo> {
    return this.call("POST", "/api/todos", todoSchema, input);
  }

  update(id: string, input: UpdateTodoInput): Promise<Todo> {
    return this.call("PATCH", todoPath(id), todoSchema, input);
  }

  async delete(id: string): Promise<void> {
    await this.call("DELETE", todoPath(id), null);
  }

  private async call<T>(
    method: string,
    path: string,
    schema: ZodType<T> | null,
    body?: unknown,
  ): Promise<T> {
    const response = await reach(this.server, () =>
      fetch(`${this.server}${path}`, {
        method,
        headers: {
          ...bearer(this.token),
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
    const json: unknown =
      response.status === 204
        ? undefined
        : await response.json().catch(() => {
            throw unexpected(
              `${method} ${path} answered ${response.status} with a body that is not JSON`,
            );
          });

    if (!response.ok) {
      const error = errorBodySchema.safeParse(json);
      if (!error.success) {
        throw unexpected(
          `${method} ${path} failed with status ${response.status}`,
        );
      }
      const { code, message } = error.data.error;
      if (code === "unauthorized") throw sessionExpired(this.server);
      throw new CliError(code, message);
    }

    if (!schema) return undefined as T;
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw unexpected(
        `${method} ${path} answered outside the contract: ${parsed.error.message}`,
      );
    }
    return parsed.data;
  }
}

function todoPath(id: string) {
  return `/api/todos/${encodeURIComponent(id)}`;
}

function unexpected(message: string) {
  return new CliError("unexpected-error", message);
}

export function notLoggedIn(server: string) {
  return new CliError(
    "unauthorized",
    `Not logged in to ${server}. Run: todo-cat login`,
  );
}

export function sessionExpired(server: string) {
  return new CliError(
    "unauthorized",
    `Your session for ${server} expired or was revoked. Run: todo-cat login`,
  );
}
