import { deviceAuthorizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Browser client for the sign-up, sign-in and sign-out forms and the /device approval page;
// same origin, so no baseURL.
export const authClient = createAuthClient({
  plugins: [deviceAuthorizationClient()],
});
