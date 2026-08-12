import { cn } from '../cn';
import { useCountdown } from '../hooks/useCountdown';

export interface CountdownLabels {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
  /** Announced to screen readers, e.g. "38 days and 4 hours until departure". */
  announce: (days: number, hours: number) => string;
}

export interface CountdownTimerProps {
  /** Absolute instant, from the API. Never a duration computed on the client. */
  target: Date | string;
  labels: CountdownLabels;
  /** Rendered instead of the clock once the target is in the past. */
  passed?: React.ReactNode;
  className?: string;
}

/** Two digits, but a day count over 99 is allowed to be three — the layout must cope. */
function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * The departure countdown.
 *
 * One implementation for both sites. Choice and the Umrah homepage disagree by a day today
 * because one rounds up and the other down; `useCountdown` settles that.
 *
 * The seconds cell is hidden from assistive technology and a separate live region announces
 * only days and hours, once a minute. A polite live region wired to a one-second tick makes a
 * screen reader read the whole clock aloud sixty times a minute, which renders the page
 * unusable — the prototypes have no live region at all, which is the opposite failure.
 */
export function CountdownTimer({ target, labels, passed, className }: CountdownTimerProps) {
  const { days, hours, minutes, seconds, hasPassed } = useCountdown(target);

  if (hasPassed && passed !== undefined) return <>{passed}</>;

  const cells = [
    { value: days, label: labels.days, pad: false },
    { value: hours, label: labels.hours, pad: true },
    { value: minutes, label: labels.minutes, pad: true },
    { value: seconds, label: labels.seconds, pad: true },
  ];

  return (
    <div className={cn('grid grid-cols-4 gap-3 mob:grid-cols-2', className)}>
      {cells.map((cell, index) => (
        <div
          key={cell.label}
          // The seconds cell changes every second; announcing it is noise, not information.
          aria-hidden={index === 3 || undefined}
          // The clock only ever sits on a dark card, so these read from `--c-border-rgb`,
          // which a dark surface flips to the brand cream. Written as arbitrary rgba values
          // they compiled to nothing at all: Tailwind cannot infer the type of an arbitrary
          // value containing `var()`, and it fails silently.
          className="rounded-sm border border-line bg-line-soft px-[10px] py-[18px] text-center"
        >
          <div className="font-medium text-countdown text-dark-on tabular-nums">
            {cell.pad ? pad(cell.value) : String(cell.value)}
          </div>
          <div className="mt-[10px] font-bold text-label uppercase text-muted">{cell.label}</div>
        </div>
      ))}

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {/* Re-rendered every second but its text only changes once a minute, so assistive
            technology announces it about that often. */}
        {minutes >= 0 ? labels.announce(days, hours) : ''}
      </p>
    </div>
  );
}
