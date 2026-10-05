import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { CLI_CLIENT_ID, formatUserCode } from "@todo-cat/contract";

// The browser half of `todo-cat login`: the CLI's requests are made with `request`,
// the human's approval in the page.

const grantType = "urn:ietf:params:oauth:grant-type:device_code";

test("a new user signs up from the code link and approves the login", async ({
  page,
  request,
}) => {
  const code = await (
    await request.post("/api/auth/device/code", {
      data: { client_id: CLI_CLIENT_ID },
    })
  ).json();

  // Signed out, the link goes to log in, then sign up, and comes back with the code.
  await page.goto(code.verification_uri_complete);
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByRole("link", { name: "Create an account" }).click();
  await page.getByLabel("Name").fill("Ada");
  await page.getByLabel("Email").fill(`e2e-${randomUUID()}@example.com`);
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/device\?user_code=/);
  await expect(page.getByLabel("Code")).toHaveValue(
    formatUserCode(code.user_code),
  );
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByRole("status")).toHaveText(/Approved/);

  const token = await request.post("/api/auth/device/token", {
    data: {
      grant_type: grantType,
      device_code: code.device_code,
      client_id: CLI_CLIENT_ID,
    },
  });
  expect(token.ok()).toBe(true);
  expect((await token.json()).access_token).toBeTruthy();
});

test("a denied login gets no token", async ({ page, request }) => {
  const code = await (
    await request.post("/api/auth/device/code", {
      data: { client_id: CLI_CLIENT_ID },
    })
  ).json();

  await page.goto(`/signup?next=${encodeURIComponent("/device")}`);
  await page.getByLabel("Name").fill("Grace");
  await page.getByLabel("Email").fill(`e2e-${randomUUID()}@example.com`);
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/device$/);
  await page.getByLabel("Code").fill(code.user_code);
  await page.getByRole("button", { name: "Deny" }).click();
  await expect(page.getByRole("status")).toHaveText(/Denied/);

  const token = await request.post("/api/auth/device/token", {
    data: {
      grant_type: grantType,
      device_code: code.device_code,
      client_id: CLI_CLIENT_ID,
    },
  });
  expect((await token.json()).error).toBe("access_denied");
});
