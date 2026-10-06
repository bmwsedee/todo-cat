import {
  A2UIProvider,
  A2UIRenderer,
  useA2UIActions,
} from "@copilotkit/a2ui-renderer";
import { render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, test } from "vitest";
import { todoCatCatalog } from "@/components/a2ui-catalog";
import {
  PROGRESS_SURFACE_ID,
  type Progress,
  progressCard,
} from "@/lib/lissie/progress-card";

/** Feeds the operations to the provider, as the chat does with a tool's result. */
function Operations({ progress }: { progress: Progress }) {
  const { processMessages } = useA2UIActions();
  useEffect(() => {
    processMessages(progressCard(progress).a2ui_operations);
  }, [processMessages, progress]);
  return null;
}

function renderCard(progress: Progress) {
  render(
    <A2UIProvider catalog={todoCatCatalog}>
      <Operations progress={progress} />
      <A2UIRenderer surfaceId={PROGRESS_SURFACE_ID} />
    </A2UIProvider>,
  );
}

describe("the progress card in the catalog", () => {
  test("renders the numbers from the data model", async () => {
    renderCard({ total: 5, done: 3, open: 2 });

    const bar = await screen.findByRole("progressbar", { name: "Done" });
    expect(bar.getAttribute("aria-valuetext")).toBe("3 of 5");
    expect(screen.getByText("Your list")).toBeDefined();
    expect(screen.getByText("2 still open")).toBeDefined();
  });

  test("renders an empty list", async () => {
    renderCard({ total: 0, done: 0, open: 0 });

    const bar = await screen.findByRole("progressbar", { name: "Done" });
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
    expect(screen.getByText("0 still open")).toBeDefined();
  });
});
