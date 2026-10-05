import { expect, test } from "vitest";
import { nextPath, withNext } from "./next-path";

test("keeps a path on this site", () => {
  expect(nextPath("/device?user_code=ABCD")).toBe("/device?user_code=ABCD");
});

test.each([
  [undefined],
  [["/a", "/b"]],
  ["https://evil.example"],
  ["//evil.example"],
  ["/\\evil.example"],
  ["device"],
])("falls back to the home page for %j", (value) => {
  expect(nextPath(value)).toBe("/");
});

test("adds next only when it is not the home page", () => {
  expect(withNext("/signup", "/")).toBe("/signup");
  expect(withNext("/signup", "/device?user_code=AB")).toBe(
    "/signup?next=%2Fdevice%3Fuser_code%3DAB",
  );
});
