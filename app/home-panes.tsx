"use client";

import { type ReactNode, useState } from "react";
import { focusRing } from "@/components/ui/button";

type Pane = "list" | "chat";

/**
 * The list and the chat side by side on a desktop; on a phone a switch shows one at a time.
 * Both stay mounted either way, so the chat keeps its conversation and the list its edits.
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
          className={`${shown("list")} min-h-0 w-full flex-col overflow-y-auto py-5 lg:flex lg:w-[25rem] lg:shrink-0 lg:border-r-2 lg:border-line lg:py-8 lg:pr-10`}
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
      className={`rounded-md py-1.5 font-bold transition-colors ${pressed ? "bg-ink text-fog" : "text-ink-soft hover:text-ink"} ${focusRing}`}
    >
      {children}
    </button>
  );
}
