import { expect } from "vitest";

/**
 * Signs up a fresh user through the real auth endpoint and returns the session token it
 * hands out. Import it after `stubTempDatabase()`; it loads the auth route on first use.
 */
export async function signUp(name: string) {
  const { POST } = await import("@/app/api/auth/[...all]/route");
  const response = await POST(
    new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        email: `${crypto.randomUUID()}@example.com`,
        password: "correct horse battery",
      }),
    }),
  );
  expect(response.status).toBe(200);
  const token = response.headers.get("set-auth-token");
  expect(token).toBeTruthy();
  return token as string;
}
