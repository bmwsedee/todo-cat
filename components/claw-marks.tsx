// Three tapered ginger scratches: raked across a done todo's title in place of a strikethrough,
// and once, large, beside the sign-in pages. By default it stretches over whatever positioned
// box it sits in, so it covers wrapped titles too. Decorative only: the checkbox and the Done
// list carry the state, and the title stays readable on top. `swipe` draws it left to right, once.
const scratches = [
  "M0 10 Q50 4 100 6 Q50 9.6 0 10 Z",
  "M2 18 Q50 12 99 14 Q50 17.6 2 18 Z",
  "M4 26 Q52 20 97 22 Q50 25.6 4 26 Z",
];

const behindTheBox =
  "pointer-events-none absolute inset-x-[-0.25rem] -inset-y-1 -z-10 h-[calc(100%+0.5rem)] w-[calc(100%+0.5rem)]";

export function ClawMarks({
  swipe = false,
  className = behindTheBox,
}: {
  swipe?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className={`fill-ginger ${swipe ? "animate-claw motion-reduce:animate-none" : ""} ${className}`}
    >
      {scratches.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
