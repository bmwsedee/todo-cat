import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { CliError } from "./errors";

// Where the CLI talks to and where it keeps its login. See tech-docs/cli.md.

export const DEFAULT_SERVER_URL = "http://localhost:3000";

/** The server from TODO_CAT_URL (or the default), as an origin-like URL without a trailing slash. */
export function serverUrl(): string {
  const value = process.env.TODO_CAT_URL || DEFAULT_SERVER_URL;
  if (!URL.canParse(value)) {
    throw new CliError(
      "usage-error",
      `TODO_CAT_URL is not a URL: ${JSON.stringify(value)}`,
    );
  }
  return new URL(value).href.replace(/\/+$/, "");
}

/** TODO_CAT_CONFIG_DIR, else the platform's per-user config directory plus `todo-cat`. */
export function configDir(): string {
  if (process.env.TODO_CAT_CONFIG_DIR) return process.env.TODO_CAT_CONFIG_DIR;
  const base =
    process.platform === "win32"
      ? process.env.APPDATA || join(homedir(), "AppData", "Roaming")
      : process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(base, "todo-cat");
}

export function credentialsPath(): string {
  return join(configDir(), "credentials.json");
}

// One session token per server, so a token is only ever sent to the server that issued it.
const credentialsSchema = z.object({
  servers: z.record(z.string(), z.object({ token: z.string() })),
});
type Credentials = z.infer<typeof credentialsSchema>;

async function readCredentials(): Promise<Credentials> {
  let text: string;
  try {
    text = await readFile(credentialsPath(), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { servers: {} };
    }
    throw error;
  }
  // A file we cannot read is as good as no login; the next login rewrites it.
  try {
    return credentialsSchema.parse(JSON.parse(text));
  } catch {
    return { servers: {} };
  }
}

/** Writes owner-only (0600 in a 0700 directory) through a temp file, so a crash never leaves half a file. */
async function writeCredentials(credentials: Credentials): Promise<void> {
  const dir = configDir();
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const temp = join(dir, `.credentials-${randomUUID()}.tmp`);
  await writeFile(temp, `${JSON.stringify(credentials, null, 2)}\n`, {
    mode: 0o600,
  });
  await rename(temp, credentialsPath());
  // `mode` only applies to new files and directories; tighten ones that already existed.
  // On Windows chmod cannot express this; the per-user profile directory's ACL protects the file.
  if (process.platform !== "win32") {
    await chmod(dir, 0o700);
    await chmod(credentialsPath(), 0o600);
  }
}

export async function readToken(server: string): Promise<string | null> {
  return (await readCredentials()).servers[server]?.token ?? null;
}

export async function saveToken(server: string, token: string): Promise<void> {
  const credentials = await readCredentials();
  credentials.servers[server] = { token };
  await writeCredentials(credentials);
}

export async function deleteToken(server: string): Promise<void> {
  const credentials = await readCredentials();
  if (!(server in credentials.servers)) return;
  delete credentials.servers[server];
  await writeCredentials(credentials);
}
