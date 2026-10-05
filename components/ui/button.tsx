import type { ComponentProps } from "react";

const variants = {
  // The one action a form exists for.
  primary: "bg-ink text-fog hover:bg-ink/85",
  // Everything else, such as signing out.
  secondary: "border-2 border-ink text-ink hover:bg-ink/10",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: { variant?: keyof typeof variants } & ComponentProps<"button">) {
  return (
    <button
      className={`rounded-lg px-5 py-2.5 text-base font-bold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber disabled:cursor-wait disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
