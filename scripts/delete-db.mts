// Deletes the local SQLite file named by DATABASE_URL, with its journal files.
// `npm run db:reset` runs this and then `drizzle-kit migrate`. See tech-docs/database.md.
import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
// @next/env is CommonJS, so Node only offers it as a default import.
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set; copy .env.example to .env");
}

// libsql accepts `file:relative/path` (relative to the working directory) and `file:///absolute/path`.
let file: string;
if (url.startsWith("file://")) {
  file = fileURLToPath(url);
} else if (url.startsWith("file:")) {
  file = resolve(url.slice("file:".length));
} else {
  throw new Error(`Refusing to delete a non-file database: ${url}`);
}

for (const suffix of ["", "-wal", "-shm", "-journal"]) {
  rmSync(file + suffix, { force: true });
}
console.log(`Deleted ${file}`);
