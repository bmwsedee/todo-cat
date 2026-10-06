import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { formatDueDate } from "@/lib/due-date";

async function signUp(page: Page) {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Ada");
  await page.getByLabel("Email").fill(`e2e-${randomUUID()}@example.com`);
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Hi, Ada." })).toBeVisible();
}

function lists(page: Page) {
  const list = page.getByRole("region", { name: "Your list" });
  return {
    list,
    open: list.getByRole("list", { name: "To do" }),
    done: list.getByRole("list", { name: "Done" }),
  };
}

test("adds a todo with a due date, checks it off and opens it again", async ({
  page,
}) => {
  await signUp(page);
  const { list, open, done } = lists(page);
  await expect(list).toContainText("Nothing yet.");

  // Far enough ahead that it is never overdue.
  const dueDate = "2099-01-02";
  await list
    .getByRole("textbox", { name: "New todo" })
    .fill("Buy the good tuna");
  await list.getByLabel("Due").fill(dueDate);
  await list.getByRole("button", { name: "Add", exact: true }).click();

  await expect(open).toContainText("Buy the good tuna");
  await expect(open).toContainText(`due ${formatDueDate(dueDate)}`);
  // The form clears for the next one.
  await expect(list.getByRole("textbox", { name: "New todo" })).toHaveValue("");

  await list.getByRole("checkbox", { name: "Buy the good tuna" }).check();
  await expect(done).toHaveText("Buy the good tuna");
  await expect(open).toHaveCount(0);

  // It was saved, not just shown.
  await page.reload();
  await expect(
    lists(page).done.getByRole("checkbox", { name: "Buy the good tuna" }),
  ).toBeChecked();

  await lists(page)
    .list.getByRole("checkbox", { name: "Buy the good tuna" })
    .uncheck();
  await expect(lists(page).open).toContainText("Buy the good tuna");
  await expect(lists(page).done).toHaveCount(0);
});

test("deletes a todo only once the user confirms", async ({ page }) => {
  await signUp(page);
  const { list, open } = lists(page);
  for (const title of ["Feed the cat", "Clean the litter box"]) {
    await list.getByRole("textbox", { name: "New todo" }).fill(title);
    await list.getByRole("button", { name: "Add", exact: true }).click();
    await expect(open).toContainText(title);
  }

  const bin = list.getByRole("button", { name: "Delete “Feed the cat”" });
  await bin.click();
  await list.getByRole("button", { name: "Keep" }).click();
  await expect(open).toContainText("Feed the cat");
  await expect(bin).toBeFocused();

  await bin.click();
  await list.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(open.getByRole("listitem")).toHaveText(["Clean the litter box"]);

  await page.reload();
  await expect(lists(page).open.getByRole("listitem")).toHaveText([
    "Clean the litter box",
  ]);
});

// Lissie and the CLI change the list elsewhere; REST stands in for them here.
test("shows todos changed elsewhere", async ({ page }) => {
  await signUp(page);

  // The page's request context carries the session cookie, which the REST API accepts.
  const add = (title: string) =>
    page.request.post("/api/todos", { data: { title } });
  const milk = await (await add("Buy milk")).json();
  await add("Feed the cat");
  expect(
    (
      await page.request.patch(`/api/todos/${milk.id}`, {
        data: { done: true },
      })
    ).status(),
  ).toBe(200);
  await page.reload();

  const { open, done } = lists(page);
  await expect(open).toHaveText("Feed the cat");
  await expect(done).toHaveText("Buy milk");
});
