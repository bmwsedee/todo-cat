import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("signs up, signs out and signs back in", async ({ page }) => {
  // Unique per attempt, so a CI retry does not hit "already exists".
  const email = `e2e-${randomUUID()}@example.com`;
  const password = "correct horse battery";
  const greeting = page.getByRole("heading", { name: "Hi, Ada." });

  await page.goto("/signup");
  await page.getByLabel("Name").fill("Ada");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(greeting).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  // The session is gone server-side too, not just in the client.
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("wrong horse battery");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "don't match" }),
  ).toBeVisible();

  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(greeting).toBeVisible();
});
