import type { ComponentProps } from "react";

// A labelled text input; every form field uses it so inputs look the same everywhere.
export function Field({
  label,
  ...inputProps
}: { label: string } & ComponentProps<"input">) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      <input
        className="rounded-lg border-2 border-line bg-paper px-3.5 py-2.5 text-base text-ink placeholder:text-ink-soft focus:border-ink focus:outline-3 focus:outline-offset-2 focus:outline-amber"
        {...inputProps}
      />
    </label>
  );
}
