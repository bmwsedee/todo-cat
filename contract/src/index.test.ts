import { expect, test } from "vitest";
import {
  addTodoInputSchema,
  errorBodySchema,
  formatUserCode,
  listTodosFilterSchema,
  updateTodoInputSchema,
} from "./index";

test("trims titles and rejects blank or overlong ones", () => {
  expect(addTodoInputSchema.parse({ title: "  Nap  " })).toEqual({
    title: "Nap",
  });
  expect(addTodoInputSchema.safeParse({ title: "   " }).success).toBe(false);
  expect(addTodoInputSchema.safeParse({ title: "x".repeat(201) }).success).toBe(
    false,
  );
});

test("accepts real calendar dates only, as yyyy-mm-dd", () => {
  const due = (dueDate: unknown) =>
    addTodoInputSchema.safeParse({ title: "Vet", dueDate }).success;

  expect(due("2028-02-29")).toBe(true);
  expect(due(null)).toBe(true);
  expect(due("2026-02-29")).toBe(false);
  expect(due("2026-10-5")).toBe(false);
  expect(due("2026-10-05T00:00:00Z")).toBe(false);
});

test("rejects unknown input fields, so a typo fails instead of being ignored", () => {
  expect(updateTodoInputSchema.safeParse({ titel: "Nap" }).success).toBe(false);
  expect(
    addTodoInputSchema.safeParse({ title: "Nap", done: true }).success,
  ).toBe(false);
});

test("treats a blank text filter as no filter", () => {
  expect(listTodosFilterSchema.parse({ text: "  " })).toEqual({});
  expect(
    listTodosFilterSchema.parse({ status: "done", text: " tuna " }),
  ).toEqual({ status: "done", text: "tuna" });
  expect(listTodosFilterSchema.safeParse({ status: "later" }).success).toBe(
    false,
  );
});

test("parses the error body", () => {
  const body = { error: { code: "todo-not-found", message: "No todo" } };

  expect(errorBodySchema.parse(body)).toEqual(body);
  expect(
    errorBodySchema.safeParse({ error: { code: "teapot", message: "" } })
      .success,
  ).toBe(false);
});

test("shows an eight-letter login code in two halves", () => {
  expect(formatUserCode("ABCDEFGH")).toBe("ABCD-EFGH");
  expect(formatUserCode("ABC")).toBe("ABC");
});
