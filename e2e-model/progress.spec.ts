import { expect, test } from "@playwright/test";
import { requireRealModel, say, signUp } from "./chat";

test.beforeAll(requireRealModel);

test("Lissie shows how far along the list is as a card, counted from the list", async ({
  page,
}) => {
  await signUp(page, "Ada");
  const titles = ["buy milk", "book the vet", "feed the cat"];
  const added = await Promise.all(
    titles.map(async (title) => {
      const response = await page.request.post("/api/todos", {
        data: { title },
      });
      return (await response.json()) as { id: string; title: string };
    }),
  );
  const fed = added.find((todo) => todo.title === "feed the cat");
  await page.request.patch(`/api/todos/${fed?.id}`, { data: { done: true } });

  const reply = await say(page, "How am I doing with my list?");
  console.log(`Lissie, on progress: ${reply}`);
  const bar = page.getByRole("progressbar", { name: "Done" });
  await expect(bar).toHaveAttribute("aria-valuetext", "1 of 3");
  await expect(page.getByText("2 still open")).toBeVisible();

  // The card comes back with the rest of the conversation.
  await page.reload();
  await expect(bar).toHaveAttribute("aria-valuetext", "1 of 3");
});
