import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { betterAuth } from "better-auth/minimal";
import { adapterConfig, authOptions } from "@/lib/auth-options";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";

// The Better Auth instance. Outside `app/api/auth`, read the signed-in user through
// `getUserId` in `lib/session.ts` instead of calling `auth.api.getSession`.
export const auth = betterAuth({
  ...authOptions,
  database: drizzleAdapter(db, { ...adapterConfig, schema }),
});
