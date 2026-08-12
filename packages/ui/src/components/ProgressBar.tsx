import { cn } from '../cn';

export interface ProgressBarProps {
  /** Places taken. */
  value: number;
  /** Places on the trip. */
  max: number;
  /** Accessible name — «Набор группы». The bar has no visible label of its own. */
  label: string;
  /** What the number means in words, e.g. «33 из 45 мест». Announced instead of a bare percent. */
  valueText?: string;
  className?: string;
}

/**
 * The seats-taken bar.
 *
 * Its width is computed. The prototype writes `width: 73%` as a literal beside a caption
 * reading `33 / 45`, which is 73.33% — so the bar and the number beside it disagree, and the
 * bar stays at 73% no matter what the trip actually sells. Everything here comes from the two
 * numbers, and the fraction is kept: rounding to a whole percent is how the two drifted apart
 * in the first place.
 *
 * `role="progressbar"` with a real `aria-valuetext`, because "seventy-three percent" is not
 * what a pilgrim wants to hear — "33 of 45 places" is.
 */
export function ProgressBar({ value, max, label, valueText, className }: ProgressBarProps) {
  const safeMax = Math.max(1, max);
  const clamped = Math.min(Math.max(0, value), safeMax);
  const percent = (clamped / safeMax) * 100;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuetext={valueText}
      className={cn('h-[9px] w-full overflow-hidden rounded-full bg-line-rule', className)}
    >
      <div
        // The one inline style in this package: a width that is data, not design. Tailwind
        // cannot express an arbitrary runtime percentage without generating a class per value.
        style={{ width: `${percent.toFixed(2)}%` }}
        className="h-full rounded-full bg-gradient-to-r from-accent to-accent-hover transition-[width] duration-indicator ease-slide"
      />
    </div>
  );
}
