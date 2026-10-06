import { useId } from "react";

/**
 * A labelled bar for `value` out of `max`, with the count beside the label. An empty
 * `max` (nothing to do yet) shows an empty bar rather than dividing by zero.
 */
export function ProgressBar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const labelId = useId();
  const percent =
    max > 0 ? Math.round((Math.min(Math.max(value, 0), max) / max) * 100) : 0;
  return (
    <div className="m-2 text-sm">
      <div className="flex items-baseline justify-between gap-4">
        <span id={labelId} className="font-bold text-ink">
          {label}
        </span>
        <span className="text-ink-soft tabular-nums">
          {value} of {max}
        </span>
      </div>
      <div
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${value} of ${max}`}
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-line"
      >
        <div
          className="h-full rounded-full bg-ink"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
