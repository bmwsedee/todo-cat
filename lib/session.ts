import { auth } from "@/lib/auth";

/**
 * Maps a request to the signed-in user's id, or null when it carries no valid session.
 * Accepts the session cookie (browser) and `Authorization: Bearer <token>` (REST API, CLI).
 * Every adapter (pages, REST, agent tools, MCP) resolves the user here; nothing else reads sessions.
 */
export async function getUserId(headers: Headers): Promise<string | null> {
  const session = await auth.api.getSession({ headers });
  return session?.user.id ?? null;
}
