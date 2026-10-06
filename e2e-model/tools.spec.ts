import { expect, test } from "@playwright/test";
import { requireRealModel, say, signUp } from "./chat";

test.beforeAll(requireRealModel);

test("Lissie keeps the list: what she adds and completes shows up in the list", async ({
  page,
}) => {
  await signUp(page, "Ada");
  const list = page.getByRole("region", { name: "Your list" });
  const open = list.getByRole("list", { name: "To do" });
  const done = list.getByRole("list", { name: "Done" });

  const added = await say(page, "Please add buy milk to my list.");
  console.log(`Lissie, adding: ${added}`);
  // No reload: the list refreshes when her tool returns.
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
