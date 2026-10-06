import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ProgressBar } from "@/components/progress-bar";

function bar() {
  return screen.getByRole("progressbar", { name: "Done" });
}

describe("ProgressBar", () => {
  test("shows the count and fills to the share that is done", () => {
    render(<ProgressBar label="Done" value={3} max={4} />);

    expect(screen.getByText("3 of 4")).toBeDefined();
    expect(bar().getAttribute("aria-valuenow")).toBe("75");
    expect(bar().getAttribute("aria-valuetext")).toBe("3 of 4");
    expect((bar().firstElementChild as HTMLElement).style.width).toBe("75%");
  });

  test("is empty, not broken, when there is nothing to count", () => {
    render(<ProgressBar label="Done" value={0} max={0} />);

    expect(screen.getByText("0 of 0")).toBeDefined();
    expect(bar().getAttribute("aria-valuenow")).toBe("0");
    expect((bar().firstElementChild as HTMLElement).style.width).toBe("0%");
  });

  test("fills no further than full", () => {
    render(<ProgressBar label="Done" value={5} max={4} />);

    expect(bar().getAttribute("aria-valuenow")).toBe("100");
  });
});
