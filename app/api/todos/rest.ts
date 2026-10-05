import type { ErrorBody, ErrorCode } from "@todo-cat/contract";
import type { ZodType } from "zod";
import { getUserId } from "@/lib/session";
import { TodoError } from "@/lib/todo-service";

// The REST adapter's shared plumbing: resolve the user, parse input with a contract schema,
// map errors to status codes. No business rules here. See tech-docs/rest-api.md.

const statusFor: Record<ErrorCode, number> = {
  unauthorized: 401,
  "todo-not-found": 404,
  "validation-failed": 400,
};

function errorResponse(code: ErrorCode, message: string) {
  const body: ErrorBody = { error: { code, message } };
  return Response.json(body, { status: statusFor[code] });
}

/** Input that fails its contract schema; mapped to 400 `validation-failed`. */
class InvalidInput extends Error {}

/** Parses `input` with a contract schema, or throws `InvalidInput` listing every issue. */
export function parse<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new InvalidInput(
    result.error.issues
      .map(({ path, message }) =>
        path.length ? `${path.join(".")}: ${message}` : message,
      )
      .join("; "),
  );
}

/** Parses the JSON body with a contract schema; a body that is not JSON is invalid input too. */
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new InvalidInput("The request body is not valid JSON");
  }
  return parse(schema, body);
}

/**
 * Runs `handle` for the signed-in user (session cookie or bearer token), or answers 401.
 * Turns `TodoError` and `InvalidInput` into the contract's error body.
 */
export async function withUser(
  request: Request,
  handle: (userId: string) => Promise<Response>,
): Promise<Response> {
  const userId = await getUserId(request.headers);
  if (!userId) {
    return errorResponse(
      "unauthorized",
      "Send Authorization: Bearer <session token> or a session cookie",
    );
  }
  try {
    return await handle(userId);
  } catch (error) {
    if (error instanceof TodoError)
      return errorResponse(error.code, error.message);
    if (error instanceof InvalidInput)
      return errorResponse("validation-failed", error.message);
    throw error;
  }
}
