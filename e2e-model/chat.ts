import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { expect, type Page } from "@playwright/test";

// Shared by the specs in e2e-model/, which talk to the real model.

/** For `test.beforeAll`: fails fast without a real key instead of timing out on every turn. */
export function requireRealModel() {
  loadEnvConfig(process.cwd());
  const key = process.env.OPENROUTER_API_KEY ?? "";
  if (key.length < 20) {
    throw new Error(
      "test:e2e:model talks to the real model; put a real OPENROUTER_API_KEY in .env",
    );
  }
}

export async function signUp(page: Page, name: string) {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(`e2e-${randomUUID()}@example.com`);
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByRole("heading", { name: `Hi, ${name}.` }),
  ).toBeVisible();
}

/** Sends `text` to Lissie and returns the text of her last reply once the run is done. */
export async function say(page: Page, text: string) {
  const replies = page.locator(".copilotKitAssistantMessage");
  const before = await replies.count();
  await page
    .getByRole("textbox", { name: "Tell Lissie what needs doing" })
    .fill(text);
  const run = page.waitForResponse((response) =>
    response.url().endsWith("/api/copilotkit/agent/lissie/run"),
  );
  await page.getByRole("button", { name: "Send to Lissie" }).click();
  // The run streams its events in one response; it is done when that response is.
  await (await run).finished();
  // A turn with a tool call can be two messages: the call, then the text after it.
  await expect.poll(() => replies.count()).toBeGreaterThan(before);
  await expect(
    page.getByRole("alert").filter({ hasText: "Lissie" }),
  ).toHaveCount(0);
  const reply = (await replies.last().innerText()).trim();
  expect(reply).not.toBe("");
  return reply;
}
