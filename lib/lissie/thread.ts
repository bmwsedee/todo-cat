/**
 * The one conversation a user has with Lissie. Derived from the user id on the server,
 * so the runtime can check that a request names the caller's own thread without a lookup.
 */
export function lissieThreadId(userId: string) {
  return `lissie-${userId}`;
}
