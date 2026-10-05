// Where to go after logging in or signing up, from the `?next=` query parameter. Only
// same-site paths are accepted, so the parameter cannot send anyone to another site.

/** `value` if it is a path on this site, otherwise the home page. */
export function nextPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  // "//host" and "/\host" are protocol-relative URLs to another site.
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  ) {
    return "/";
  }
  return value;
}

/** `path` with `?next=` added, unless next is the home page anyway. */
export function withNext(path: string, next: string): string {
  return next === "/" ? path : `${path}?next=${encodeURIComponent(next)}`;
}
