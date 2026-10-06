"use client";

import { type ReactNode, useState } from "react";
import { colorFade, focusRing } from "@/components/ui/button";

type Pane = "list" | "chat";

/**
 * The list and the chat side by side on a desktop; on a phone a switch shows one at a time.
 * Both stay mounted either way, so the chat keeps its conversation and the list its edits.
 * The list is the main column. Its pane scrolls, so it reaches 0.5rem past the page's gutter
 * and pads it back, which leaves room for the focus rings of the inputs and checkboxes.
 */
export function HomePanes({
  list,
  chat,
  openCount,
}: {
  list: ReactNode;
  chat: ReactNode;
  openCount: number;
}) {
  const [pane, setPane] = useState<Pane>("list");
  const shown = (which: Pane) => (pane === which ? "flex" : "hidden");

  return (
    <>
      <fieldset className="mt-3 grid grid-cols-2 rounded-lg border-2 border-line p-1 lg:hidden">
        <legend className="sr-only">Show</legend>
        <SwitchButton pressed={pane === "list"} onClick={() => setPane("list")}>
          List
          {openCount > 0 && (
            <span className="ml-2 text-sm font-semibold opacity-75">
              {openCount}
            </span>
          )}
        </SwitchButton>
        <SwitchButton pressed={pane === "chat"} onClick={() => setPane("chat")}>
          Lissie
        </SwitchButton>
      </fieldset>
      <main className="flex min-h-0 flex-1">
        <div
          className={`${shown("list")} -mx-2 min-h-0 flex-1 flex-col overflow-y-auto px-2 py-5 lg:mr-0 lg:flex lg:w-[min(34rem,45%)] lg:flex-none lg:border-r-2 lg:border-line lg:py-8 lg:pr-10`}
        >
          {list}
        </div>
        <div
          className={`${shown("chat")} min-h-0 min-w-0 flex-1 flex-col lg:flex lg:pl-6`}
        >
          {chat}
        </div>
      </main>
    </>
  );
}

function SwitchButton({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`min-h-11 rounded-md font-bold ${colorFade} ${pressed ? "bg-ink text-fog" : "text-ink-soft hover:text-ink"} ${focusRing}`}
    >
      {children}
    </button>
  );
}
