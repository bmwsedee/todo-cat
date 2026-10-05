import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { betterAuth } from "better-auth/minimal";
import { adapterConfig, authOptions } from "../lib/auth-options";

// Config for `npm run auth:generate` only. The CLI cannot load `lib/auth.ts`, because
// `lib/db.ts` imports `server-only`; schema generation never touches the database,
// so the adapter gets an empty stand-in, and the startup schema check, which would
// only report that stand-in as empty, is off.
export const auth = betterAuth({
  ...authOptions,
  advanced: {
    ...authOptions.advanced,
    database: { ...authOptions.advanced.database, validateSchema: false },
  },
  database: drizzleAdapter({}, adapterConfig),
});
