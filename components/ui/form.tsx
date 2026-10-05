import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// Stacks fields, the error and the submit button with the same rhythm in every form.
export function Form(props: ComponentProps<"form">) {
  return <form className="flex flex-col gap-5" {...props} />;
}

// Says what went wrong with a submit; renders nothing when there is no error.
export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm font-semibold text-danger">
      {children}
    </p>
  );
}

// The line under a form that points to the other form ("New here? Create an account").
export function FormFooter({
  children,
  href,
  linkText,
}: {
  children: ReactNode;
  href: string;
  linkText: string;
}) {
  return (
    <p className="mt-8 text-ink-soft">
      {children}{" "}
      <Link
        href={href}
        className="font-semibold text-ink underline decoration-amber decoration-2 underline-offset-4 hover:decoration-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber"
      >
        {linkText}
      </Link>
    </p>
  );
}
