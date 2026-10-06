import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

// Never sends a message, so it never calls the model; e2e-model/ covers the conversation.
test("a signed-in user gets the chat with Lissie on /", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Ada");
  await page.getByLabel("Email").fill(`e2e-${randomUUID()}@example.com`);
  await page.getByLabel("Password").fill("correct horse battery");

  // The chat connects to the user's own thread, which the runtime only allows for them.
  const connected = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/copilotkit/agent/lissie/connect") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: "Hi, Ada." })).toBeVisible();
  expect((await connected).status()).toBe(200);
  const input = page.getByRole("textbox", {
    name: "Tell Lissie what needs doing",
  });
  await expect(input).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send to Lissie" }),
  ).toBeDisabled();
  await input.fill("Hello");
  await expect(
    page.getByRole("button", { name: "Send to Lissie" }),
  ).toBeEnabled();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
});

// Lissie is the browser's only way to change the list; REST stands in for her here.
test("the sidebar shows the user's open and done todos", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Ada");
  await page.getByLabel("Email").fill(`e2e-${randomUUID()}@example.com`);
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();

  const sidebar = page.getByRole("complementary", { name: "Your list" });
  await expect(sidebar).toContainText(
    "Nothing yet. Tell Lissie what needs doing.",
  );

  // The page's request context carries the session cookie, which the REST API accepts.
  const add = (title: string, dueDate?: string) =>
    page.request.post("/api/todos", { data: { title, dueDate } });
  const milk = await (await add("Buy milk", "2026-10-07")).json();
  await add("Feed the cat");
  expect(
    (
      await page.request.patch(`/api/todos/${milk.id}`, {
        data: { done: true },
      })
    ).status(),
  ).toBe(200);
  await page.reload();

  await expect(sidebar.getByRole("list", { name: "Open" })).toHaveText(
    "Feed the cat",
  );
  await expect(sidebar.getByRole("list", { name: "Done" })).toHaveText(
    "Buy milk",
  );
});
