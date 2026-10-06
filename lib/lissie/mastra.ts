import "server-only";
import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { db } from "@/lib/db";
import { lissie } from "@/lib/lissie/agent";

// Mastra keeps its tables (threads, messages, …) in the app's SQLite file, on the same
// libsql client as Drizzle, and creates them itself; they are not Drizzle migrations.
export const mastra = new Mastra({
  agents: { lissie },
  storage: new LibSQLStore({ id: "todo-cat", client: db.$client }),
});
