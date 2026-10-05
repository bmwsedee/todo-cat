import "server-only";
import { drizzle } from "drizzle-orm/libsql";
import { authRelations } from "@/lib/auth-schema";

// The only place that opens the database; everything else imports `db` from here.
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set; copy .env.example to .env");
}

export const db = drizzle({ connection: { url }, relations: authRelations });
