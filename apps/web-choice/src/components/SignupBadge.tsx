import { type Lang, type UmrahTrip } from '@charva/contracts';

import { COPY, plural } from '../i18n';

export interface SignupBadgeProps {
  trip: UmrahTrip | null;
  lang: Lang;
}

/**
 * The pill on the Umrah half: a pulsing dot and how many seats are left.
 *
 * The prototype writes `seatsLeft: 12` as a literal beside a departure whose seat count lives
 * in another file entirely, so the two disagree from the day the first person signs up. Here
 * both come from the one `umrah_trips` row.
 *
 * It also renders the states nobody drew. `departed` and «no trip at all» are question Q-4, and
 * they are not edge cases: the first happens the day a group leaves and the second the day
 * after, before the next departure is announced. The prototype has neither — its countdown
 * clamps to zeros and the badge keeps promising twelve seats forever.
 */
export function SignupBadge({ trip, lang }: SignupBadgeProps) {
  const copy = COPY[lang].badge;

  const text =
    trip === null
      ? copy.none
      : trip.status === 'departed' || trip.status === 'completed'
        ? copy.departed
        : trip.status === 'full'
          ? copy.full
          : trip.status === 'closed'
            ? copy.closed
            : plural(copy.open, trip.seatsLeft, lang);

  /** The dot only pulses while something is actually open. A group in the air is not live. */
  const live = trip !== null && trip.status === 'open';

  return (
    <span
      className="absolute right-[70px] top-[118px] z-[4] inline-flex items-center gap-2.5 rounded-full border border-tint-line bg-tint px-[18px] py-2.5 text-[12px] font-bold uppercase tracking-[.12em] text-dark-on backdrop-blur-soft tab:right-6 tab:top-20 mob:right-4 mob:top-[70px] mob:text-[11px]"
      // The whole half is one link; this pill is a label on it, not a second target.
      aria-hidden={false}
    >
      <span
        className={
          live
            ? 'size-[7px] shrink-0 rounded-full bg-accent motion-safe:animate-pulse'
            : 'size-[7px] shrink-0 rounded-full bg-accent opacity-50'
        }
        aria-hidden="true"
      />
      {text}
    </span>
  );
}
