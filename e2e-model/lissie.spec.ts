import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { expect, type Page, test } from "@playwright/test";

test.beforeAll(() => {
  loadEnvConfig(process.cwd());
  const key = process.env.OPENROUTER_API_KEY ?? "";
  if (key.length < 20) {
    throw new Error(
      "test:e2e:model talks to the real model; put a real OPENROUTER_API_KEY in .env",
    );
  }
});

async function signUp(page: Page, name: string) {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(`e2e-${randomUUID()}@example.com`);
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByRole("heading", { name: `Hi, ${name}.` }),
  ).toBeVisible();
}

async function say(page: Page, text: string) {
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
  await expect(replies).toHaveCount(before + 1);
  await expect(
    page.getByRole("alert").filter({ hasText: "Lissie" }),
  ).toHaveCount(0);
  const reply = (await replies.last().innerText()).trim();
  expect(reply).not.toBe("");
  return reply;
}

test("Lissie answers, remembers the conversation, and keeps it to its owner", async ({
  page,
  browser,
  baseURL,
}) => {
  await signUp(page, "Ada");

  const onTopic = await say(page, "Remind me to buy cat food tomorrow.");
  const offTopic = await say(page, "Write me a haiku about the ocean.");
  console.log(`Lissie, on topic: ${onTopic}\nLissie, off topic: ${offTopic}`);

  // A reload replays the thread from Mastra memory.
  await page.reload();
  await expect(
    page.getByText("Remind me to buy cat food tomorrow."),
  ).toBeVisible();
  await expect(
    page.getByText("Write me a haiku about the ocean."),
  ).toBeVisible();
  await expect(page.locator(".copilotKitAssistantMessage")).toHaveCount(2);

  // The browser sends only the new message, so she can only know this from Mastra memory.
  const recalled = await say(page, "What did I ask you to remind me about?");
  console.log(`Lissie, recalling: ${recalled}`);
  expect(recalled).toMatch(/cat food/i);

  // Someone else starts with an empty thread of their own.
  const other = await (await browser.newContext({ baseURL })).newPage();
  await signUp(other, "Bob");
  await expect(
    other.getByRole("textbox", { name: "Tell Lissie what needs doing" }),
  ).toBeVisible();
  await expect(
    other.getByText("Remind me to buy cat food tomorrow."),
  ).toHaveCount(0);
  await expect(other.locator(".copilotKitAssistantMessage")).toHaveCount(0);
  await other.close();
});
