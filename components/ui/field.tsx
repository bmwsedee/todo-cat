import type { ComponentProps } from "react";

/**
 * Every text-like input's look, so a bare `<input>` (like the add-todo row) matches the forms.
 * Size is left out: add one of `inputSizes`, since two Tailwind sizes on one element don't
 * override each other by class order.
 */
export const inputClass =
  "rounded-md border-2 border-line bg-paper text-ink placeholder:text-ink-soft focus:border-ink focus:outline-3 focus:outline-offset-2 focus:outline-focus";

export const inputSizes = {
  md: "px-3.5 py-2.5 text-base",
  // For text read character by character, like a login code.
  lg: "px-4 py-3 text-2xl font-semibold",
};

// A labelled text input; every form field uses it so inputs look the same everywhere.
export function Field({
  label,
  size = "md",
  className = "",
  ...inputProps
}: {
  label: string;
  size?: keyof typeof inputSizes;
} & Omit<ComponentProps<"input">, "size">) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      <input
        className={`${inputClass} ${inputSizes[size]} ${className}`}
        {...inputProps}
      />
    </label>
  );
}
