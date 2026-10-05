import type { BetterAuthOptions } from "better-auth";
import { bearer, deviceAuthorization } from "better-auth/plugins";

// Everything but the database, so configs that must not open it (the schema generator,
// the test instance) build from the same options as `lib/auth.ts`.

// The client id the todo-cat CLI sends when it starts a device login; no other client is accepted.
export const CLI_CLIENT_ID = "todo-cat-cli";

export const adapterConfig = { provider: "sqlite" } as const;

// Secret and base URL come from BETTER_AUTH_SECRET and BETTER_AUTH_URL.
export const authOptions = {
  advanced: { database: { joins: true } },
  emailAndPassword: { enabled: true },
  plugins: [
    // Lets `Authorization: Bearer <session token>` stand in for the session cookie.
    bearer(),
    // `gh auth login`-style CLI login; /device/token returns a session token used as the bearer token.
    deviceAuthorization({
      verificationUri: "/device",
      validateClient: (clientId) => clientId === CLI_CLIENT_ID,
    }),
  ],
} satisfies BetterAuthOptions;
