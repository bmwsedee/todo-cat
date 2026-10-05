import { run } from "./program";

// Exit code rather than process.exit, so pending stdout and stderr writes still flush.
process.exitCode = await run(process.argv);
