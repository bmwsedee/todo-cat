import { createAuthClient } from "better-auth/react";

// Browser client for the sign-up, sign-in and sign-out forms; same origin, so no baseURL.
export const authClient = createAuthClient();
