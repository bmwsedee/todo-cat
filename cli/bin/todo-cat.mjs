#!/usr/bin/env node
// The `todo-cat` binary: runs the bundle that `npm install` builds (the cli workspace's `prepare`).
import { existsSync } from "node:fs";

const bundle = new URL("../dist/todo-cat.mjs", import.meta.url);
if (!existsSync(bundle)) {
  process.stderr.write(
    "error (unexpected-error): the CLI is not built. Run: npm run build -w todo-cat-cli\n",
  );
  process.exit(1);
}
await import(bundle.href);
