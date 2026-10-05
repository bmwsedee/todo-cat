import type { ReactNode } from "react";
import { LissieEyes } from "@/components/lissie-eyes";

// The single left-aligned column every page sits in: Lissie's eyes, a headline in her voice, a lede, then the content.
export function PageShell({
  title,
  lede,
  children,
}: {
  title: ReactNode;
  lede: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16 sm:ml-[12vw]">
      <LissieEyes className="mb-8 h-10 w-auto self-start" />
      <h1 className="text-5xl leading-[0.95] font-extrabold tracking-tight text-balance [font-stretch:80%] sm:text-6xl">
        {title}
      </h1>
      <p className="mt-4 max-w-sm text-lg leading-snug text-pretty text-ink-soft">
        {lede}
      </p>
      <div className="mt-10">{children}</div>
    </main>
  );
}
