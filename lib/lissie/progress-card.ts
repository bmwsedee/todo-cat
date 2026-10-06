import { TODO_CAT_CATALOG_ID } from "@/lib/a2ui";

// Lissie's progress card as A2UI v0.9 operations: the component tree is fixed here, and the
// numbers reach it only through the surface's data model, never written into the tree.

/** How far along the list is; `done + open = total`. */
export type Progress = { total: number; done: number; open: number };

/** One A2UI v0.9 operation: a version and exactly one operation key, nested. */
export type A2UIOperation =
  | {
      version: "v0.9";
      createSurface: { surfaceId: string; catalogId: string };
    }
  | {
      version: "v0.9";
      updateComponents: {
        surfaceId: string;
        components: Record<string, unknown>[];
      };
    }
  | {
      version: "v0.9";
      updateDataModel: { surfaceId: string; path: string; value: Progress };
    };

// Each card lives in its own activity message, so one id for every card does not collide.
export const PROGRESS_SURFACE_ID = "todo-progress";

/** The card's components, flat and linked by id; `root` is where rendering starts. */
const PROGRESS_CARD_COMPONENTS = [
  {
    id: "root",
    component: "Column",
    children: ["heading", "done-bar", "open-count"],
  },
  { id: "heading", component: "Text", variant: "h4", text: "Your list" },
  {
    id: "done-bar",
    component: "ProgressBar",
    label: "Done",
    value: { path: "/done" },
    max: { path: "/total" },
  },
  {
    id: "open-count",
    component: "Text",
    // A2UI interpolates `${/open}` from the data model; escaped, as it is not JavaScript's.
    text: { call: "formatString", args: { value: `\${/open} still open` } },
  },
];

/**
 * The operations that paint the card for `progress`, wrapped in the `a2ui_operations`
 * container the A2UI middleware looks for in a tool result.
 */
export function progressCard(progress: Progress) {
  const surfaceId = PROGRESS_SURFACE_ID;
  const a2ui_operations: A2UIOperation[] = [
    {
      version: "v0.9",
      createSurface: { surfaceId, catalogId: TODO_CAT_CATALOG_ID },
    },
    {
      version: "v0.9",
      updateComponents: { surfaceId, components: PROGRESS_CARD_COMPONENTS },
    },
    {
      version: "v0.9",
      updateDataModel: { surfaceId, path: "/", value: progress },
    },
  ];
  return { a2ui_operations };
}
