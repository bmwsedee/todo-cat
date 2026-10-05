import { setTimeout as sleep } from "node:timers/promises";
import { CLI_CLIENT_ID, formatUserCode } from "@todo-cat/contract";
import type { Command } from "commander";
import {
  bearer,
  type CliAuthClient,
  createCliAuthClient,
  notLoggedIn,
  reach,
  sessionExpired,
} from "./api";
import { action, examples } from "./command";
import { deleteToken, readToken, saveToken } from "./config";
import { CliError } from "./errors";

// Login through Better Auth's device authorization flow, like `gh auth login`: the CLI
// shows a code and a URL, a signed-in human approves it in the browser, and the CLI
// keeps the session token it gets back. It never opens a browser and never prints the token.

type User = { id: string; name: string; email: string };

async function currentUser(
  server: string,
  client: CliAuthClient,
  token: string,
): Promise<User> {
  const { data, error } = await reach(server, () =>
    client.getSession({ fetchOptions: { headers: bearer(token) } }),
  );
  if (error) throw unexpected("Could not read the session", error);
  if (!data) throw sessionExpired(server);
  const { id, name, email } = data.user;
  return { id, name, email };
}

function unexpected(
  what: string,
  error: { status: number; statusText: string; message?: string },
) {
  return new CliError(
    "unexpected-error",
    `${what}: ${error.message ?? `${error.status} ${error.statusText}`}`,
  );
}

type DeviceCode = {
  device_code: string;
  expires_in: number;
  interval: number;
};

/** Polls until the code is approved, denied or expired, at the pace the server asks for. */
async function pollForToken(
  server: string,
  client: CliAuthClient,
  code: DeviceCode,
): Promise<string> {
  let interval = code.interval;
  const deadline = Date.now() + code.expires_in * 1000;
  while (Date.now() < deadline) {
    await sleep(interval * 1000);
    const { data, error } = await reach(server, () =>
      client.device.token({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: code.device_code,
        client_id: CLI_CLIENT_ID,
      }),
    );
    if (data) return data.access_token;
    switch (error.error) {
      case "authorization_pending":
        break;
      case "slow_down":
        interval += 5;
        break;
      case "access_denied":
        throw new CliError("login-denied", "The login was denied.");
      case "expired_token":
        throw loginExpired();
      default:
        throw new CliError(
          "unexpected-error",
          `Login failed: ${error.error_description ?? error.error ?? error.status}`,
        );
    }
  }
  throw loginExpired();
}

function loginExpired() {
  return new CliError(
    "login-expired",
    "The login code expired before it was approved. Run: todo-cat login",
  );
}

export function addAuthCommands(program: Command): void {
  program
    .command("login")
    .description(
      "Log in by approving a one-time code in the browser; waits until someone does",
    )
    .addHelpText(
      "after",
      `${examples("todo-cat login", "TODO_CAT_URL=https://todo.example.com todo-cat login")}

The code and the URL go to stderr (with --json as one JSON line), then the command
waits until a signed-in user approves or denies the code at that URL, or it expires.
It never opens a browser. Agents: run it in the background, pass the code and the URL
to your human, and wait for it to exit. The session token is stored owner-only in the
config directory (see todo-cat --help) and is never printed.`,
    )
    .action(
      action(async ({ server, out }) => {
        const client = createCliAuthClient(server);
        const { data: code, error } = await reach(server, () =>
          client.device.code({ client_id: CLI_CLIENT_ID }),
        );
        if (!code) throw unexpected("Could not start a login", error);

        const userCode = formatUserCode(code.user_code);
        out.progress(
          {
            userCode,
            verificationUri: code.verification_uri,
            verificationUriComplete: code.verification_uri_complete,
            expiresIn: code.expires_in,
          },
          [
            `Open ${code.verification_uri_complete}`,
            `and approve code ${userCode} (or enter it at ${code.verification_uri}).`,
            `Waiting for approval; the code expires in ${Math.round(code.expires_in / 60)} minutes.`,
          ].join("\n"),
        );

        const token = await pollForToken(server, client, code);
        const user = await currentUser(server, client, token);
        await saveToken(server, token);
        out.result(
          { server, user },
          `Logged in to ${server} as ${user.name} <${user.email}>.`,
        );
      }),
    );

  program
    .command("logout")
    .description(
      "Log out: revoke the session on the server and forget the token",
    )
    .addHelpText("after", examples("todo-cat logout"))
    .action(
      action(async ({ server, out }) => {
        const token = await readToken(server);
        if (token) {
          const client = createCliAuthClient(server);
          const { error } = await reach(server, () =>
            client.signOut({ fetchOptions: { headers: bearer(token) } }),
          );
          // A 4xx means the session is already gone; keep the token only if the server failed.
          if (error && error.status >= 500) {
            throw unexpected("Could not revoke the session", error);
          }
          await deleteToken(server);
        }
        out.result(
          { server, loggedIn: false },
          token ? `Logged out of ${server}.` : `Not logged in to ${server}.`,
        );
      }),
    );

  program
    .command("whoami")
    .description("Show who you are logged in as; exits 3 when you are not")
    .addHelpText("after", examples("todo-cat whoami", "todo-cat whoami --json"))
    .action(
      action(async ({ server, out }) => {
        const token = await readToken(server);
        if (!token) throw notLoggedIn(server);
        const user = await currentUser(
          server,
          createCliAuthClient(server),
          token,
        );
        out.result(
          { server, user },
          `Logged in to ${server} as ${user.name} <${user.email}>.`,
        );
      }),
    );
}
