import { expect, test } from "@playwright/test";
import { requireRealModel, say, signUp } from "./chat";

test.beforeAll(requireRealModel);

test("Lissie keeps the list: what she adds and completes shows up in the sidebar", async ({
  page,
}) => {
  await signUp(page, "Ada");
  const sidebar = page.getByRole("complementary", { name: "Your list" });
  const open = sidebar.getByRole("list", { name: "Open" });
  const done = sidebar.getByRole("list", { name: "Done" });

  const added = await say(page, "Please add buy milk to my list.");
  console.log(`Lissie, adding: ${added}`);
  // No reload: the sidebar refreshes when her tool returns.
  await expect(open).toContainText(/buy milk/i);
  const addLine = page.getByText(/^Added “buy milk”/i);
  await expect(addLine).toBeVisible();

  // Her tool calls come back with the rest of the conversation.
  await page.reload();
  await expect(addLine).toBeVisible();
  await expect(open).toContainText(/buy milk/i);

  const fed = await say(
    page,
    "Add feed the cat, then mark it done. I just fed you.",
  );
  console.log(`Lissie, on being fed: ${fed}`);
  await expect(done).toContainText(/feed the cat/i);
  await expect(page.getByText(/^Marked “feed the cat” done/i)).toBeVisible();
  await expect(open).toContainText(/buy milk/i);
});
