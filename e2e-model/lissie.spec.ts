import { expect, test } from "@playwright/test";
import { requireRealModel, say, signUp } from "./chat";

test.beforeAll(requireRealModel);

test("Lissie answers, remembers the conversation, and keeps it to its owner", async ({
  page,
  browser,
  baseURL,
}) => {
  await signUp(page, "Ada");

  const onTopic = await say(page, "Remind me to buy cat food tomorrow.");
  const offTopic = await say(page, "Write me a haiku about the ocean.");
  console.log(`Lissie, on topic: ${onTopic}\nLissie, off topic: ${offTopic}`);

  // A reload replays the thread from Mastra memory. A reminder makes her add a todo, so a
  // turn can be more than one message; the replay must bring back as many as there were.
  const replies = page.locator(".copilotKitAssistantMessage");
  const repliesBefore = await replies.count();
  await page.reload();
  await expect(
    page.getByText("Remind me to buy cat food tomorrow."),
  ).toBeVisible();
  await expect(
    page.getByText("Write me a haiku about the ocean."),
  ).toBeVisible();
  await expect(replies).toHaveCount(repliesBefore);

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
