// Lissie peering at you: two amber almond eyes with slit pupils. Decorative only.
// `squint` half-closes them, for while she is busy answering.
export function LissieEyes({
  className,
  squint = false,
}: {
  className?: string;
  squint?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 96 32"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {[4, 60].map((x) => (
        <g key={x} transform={`translate(${x} 0)`}>
          <g
            className={`origin-center transition-transform duration-300 ease-out [transform-box:fill-box] motion-reduce:transition-none ${squint ? "scale-y-[0.35]" : ""}`}
          >
            <path
              d="M0 16 Q16 0 32 16 Q16 32 0 16 Z"
              className="fill-amber stroke-ink"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <ellipse cx="16" cy="16" rx="2.6" ry="9" className="fill-pupil" />
          </g>
        </g>
      ))}
    </svg>
  );
}
