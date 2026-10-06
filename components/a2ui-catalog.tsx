import {
  basicCatalog,
  Catalog,
  createReactComponent,
  DataBindingSchema,
  DynamicNumberSchema,
  DynamicStringSchema,
} from "@copilotkit/a2ui-renderer";
import { ProgressBar } from "@/components/progress-bar";
import { TODO_CAT_CATALOG_ID } from "@/lib/a2ui";

/**
 * The props of A2UI's ProgressBar. A2UI's binder reads zod 3 internals to find the props
 * bound to the data model, and its types accept only schemas from its own copy of zod, so
 * this object schema grows out of one of A2UI's (an empty pick of DataBindingSchema)
 * rather than from a `z.object` of ours. The dynamic props are a literal, a `{ path }`
 * into the data model or a function call; the binder resolves them before rendering.
 */
const progressBarProps = DataBindingSchema.pick({})
  .extend({
    label: DynamicStringSchema.describe("What the bar measures"),
    value: DynamicNumberSchema.describe("How many are done"),
    max: DynamicNumberSchema.describe("How many there are in all"),
  })
  .strict()
  .describe(
    "A labelled bar for how much of something is done, with the count beside the label.",
  );

// A bound value is undefined until the data model has it.
const ProgressBarComponent = createReactComponent(
  { name: "ProgressBar", schema: progressBarProps },
  ({ props }) => (
    <ProgressBar
      label={props.label ?? ""}
      value={props.value ?? 0}
      max={props.max ?? 0}
    />
  ),
);

/** The chat's A2UI catalog: the basic components (Column, Text, …) plus ProgressBar. */
export const todoCatCatalog = new Catalog(
  TODO_CAT_CATALOG_ID,
  [...basicCatalog.components.values(), ProgressBarComponent],
  [...basicCatalog.functions.values()],
);
