import type { ReactNode } from "react";
import { ClawMarks } from "@/components/claw-marks";
import { LissieEyes } from "@/components/lissie-eyes";

// The single left-aligned column every page sits in: Lissie's eyes, a headline in her voice, a lede, then the content.
// On a wide screen her claw marks fill the empty side, drawn once as the page opens.
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
    <>
      <ClawMarks
        swipe
        className="pointer-events-none fixed top-1/2 right-[7vw] hidden aspect-[10/3] w-[34vw] max-w-[34rem] -translate-y-1/2 -rotate-[14deg] [animation-delay:150ms] lg:block"
      />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-14 sm:ml-[12vw]">
        <LissieEyes className="mb-7 h-10 w-auto self-start" />
        <h1 className="font-display text-5xl leading-[0.95] font-bold text-balance sm:text-[4.25rem]">
          {title}
        </h1>
        <p className="mt-5 max-w-sm text-lg leading-snug text-pretty text-ink-soft">
          {lede}
        </p>
        <div className="mt-10">{children}</div>
      </main>
    </>
  );
}
