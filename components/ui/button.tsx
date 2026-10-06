import type { ComponentProps } from "react";

const variants = {
  // The one action a form exists for.
  primary: "bg-ink text-fog hover:bg-ink/85",
  // Everything else, such as signing out.
  secondary: "border-2 border-ink text-ink hover:bg-ink/10",
  // Confirms something that cannot be undone, such as deleting a todo.
  danger: "bg-danger text-fog hover:bg-danger/85",
};

const sizes = {
  md: "px-5 py-2.5 text-base",
  // Inside a list row, where a full-size button would outweigh the todo.
  sm: "px-3 py-1 text-sm",
};

/** Shared by every button-shaped control, so a styled `<button>` elsewhere looks the same. */
export const focusRing =
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus";

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
} & ComponentProps<"button">) {
  return (
    <button
      className={`rounded-md font-bold transition-colors disabled:cursor-wait disabled:opacity-60 ${focusRing} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
