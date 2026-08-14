import { type Lang, type UmrahTrip } from '@charva/contracts';
import { buttonClass, CountdownTimer, Heading, ProgressBar } from '@charva/ui';
import { Link } from '@tanstack/react-router';

import { copyFor, fill } from '../i18n';
import { formatDate } from '../lib/formatDate';
import { path } from '../lib/routes';

export interface TripPanelProps {
  trip: UmrahTrip | null;
  /** The departure after this one. What the site promotes once a group is in the air. */
  next: UmrahTrip | null;
  lang: Lang;
  className?: string;
}

/**
 * The glass card in the hero, and the answer to what a visitor sees in each of the six states.
 *
 * The prototype knows one: a departure in the future with seats left. Everything else it
 * handles by arithmetic accident — `Math.max(0, TARGET - now)` clamps to zero, so the morning
 * after a group leaves the page shows `00 00 00 00` and a signup form that still accepts
 * submissions from people who believe they are going. That is not an edge case; it is the
 * fortnight after launch (D-13, question Q-4).
 *
 * The two states nobody drew — `departed` and «no departure at all» — are built from the same
 * tokens as the rest rather than invented visually, so the owner has something concrete to
 * react to. Both replace the clock instead of freezing it.
 *
 * Every number here is one field of one row. In the handoff the same departure is a hardcoded
 * `TARGET` in three files, the string `18.09.2026` in eight places, `45`, `33`, `12` and a
 * progress bar of literally `width: 73%` beside a caption reading `33 / 45` — which is 73.33%.
 */
export function TripPanel({ trip, next, lang, className }: TripPanelProps) {
  const copy = copyFor(lang);

  const panel = [
    'rounded-panel border border-line bg-cream-fill p-9 backdrop-blur-[20px] mob:p-6',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  /*
   * No departure at all.
   *
   * The first time a group returns and the next has not been announced, which is weeks after
   * launch. A page that renders nothing here would simply lose its right-hand column.
   */
  if (trip === null) {
    return (
      <div className={panel} data-state="none">
        <Heading level={2} size="h3">
          {copy.trip.states.none.title}
        </Heading>
        <p className="mt-4 text-body font-light text-body">{copy.trip.states.none.text}</p>
        <Link
          to={path.yazylmak(lang)}
          className={buttonClass({ fullWidth: true, className: 'mt-7' })}
        >
          {copy.nav.cta}
        </Link>
      </div>
    );
  }

  /*
   * The group is in the air.
   *
   * The clock is gone rather than sitting at zero, the return date is stated, and the site
   * points at the next departure when there is one.
   */
  if (trip.status === 'departed' || trip.status === 'completed') {
    const upcoming = next === null ? null : formatDate(next.departAt);

    return (
      <div className={panel} data-state="departed">
        <Heading level={2} size="h3">
          {copy.trip.states.departed.title}
        </Heading>
        <p className="mt-4 text-body font-light text-body">
          {fill(copy.trip.states.departed.text, {
            departed: formatDate(trip.departAt) ?? '',
            returns: formatDate(trip.returnAt) ?? '',
          })}
        </p>
        {upcoming !== null && (
          <p className="mt-5 rounded-panel-sm border border-tint-line bg-tint-soft px-4 py-3 text-bodySm font-semibold text-accent-text">
            {fill(copy.trip.states.nextIs, { date: upcoming })}
          </p>
        )}
        <Link
          to={path.yazylmak(lang)}
          className={buttonClass({ fullWidth: true, className: 'mt-7' })}
        >
          {copy.nav.cta}
        </Link>
      </div>
    );
  }

  const departOn = formatDate(trip.departAt);

  return (
    <div className={panel} data-state={trip.status}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-label font-black uppercase text-accent-text">
          {copy.trip.countdownTitle}
        </p>
        {departOn !== null && (
          <time dateTime={trip.departAt} className="text-bodySm text-muted">
            {departOn}
          </time>
        )}
      </div>

      {/*
        One implementation, both sites, one rounding.

        Choice rounds up and this page rounds down in the handoff, so the two disagree by a day
        on the same departure. `useCountdown` settles it; the seconds cell is hidden from
        assistive technology and a live region announces days and hours once a minute instead
        of reading the whole clock aloud sixty times.
      */}
      <CountdownTimer
        target={trip.departAt}
        className="mt-6"
        labels={{
          days: copy.trip.clock.days,
          hours: copy.trip.clock.hours,
          minutes: copy.trip.clock.minutes,
          seconds: copy.trip.clock.seconds,
          announce: (days, hours) => fill(copy.trip.announce, { days, hours }),
        }}
      />

      <div className="mt-8 border-t border-line pt-7">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-bodySm font-semibold text-ink">{copy.trip.seatsTitle}</p>
          <p className="text-bodySm text-muted">
            {fill(copy.trip.seatsOf, { taken: trip.seatsTaken, total: trip.seatsTotal })}
          </p>
        </div>

        {/* Width from the two numbers, fraction kept. Rounding to a whole percent is exactly
            how the prototype's bar and its caption came to disagree. */}
        <ProgressBar
          value={trip.seatsTaken}
          max={trip.seatsTotal}
          label={copy.trip.seatsTitle}
          valueText={fill(copy.trip.seatsOf, { taken: trip.seatsTaken, total: trip.seatsTotal })}
          className="mt-3"
        />

        <dl className="mt-5 flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-bodySm text-muted">{copy.trip.seatsLeftLabel}</dt>
            <dd className="text-bodySm font-semibold text-ink">{String(trip.seatsLeft)}</dd>
          </div>
          {trip.hotelMekka !== '' && (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-bodySm text-muted">{copy.trip.hotel}</dt>
              <dd className="text-right text-bodySm font-semibold text-ink">{trip.hotelMekka}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* The two states that keep the clock but change what can be done. Said in words rather
          than by a button that looks pressable and is not. */}
      {trip.status !== 'open' && (
        <p className="mt-6 rounded-panel-sm border border-tint-line bg-tint-soft px-4 py-3 text-bodySm text-accent-text">
          <strong className="font-semibold">{copy.trip.states[trip.status].title}.</strong>{' '}
          {copy.trip.states[trip.status].text}
        </p>
      )}

      <Link
        to={path.yazylmak(lang)}
        className={buttonClass({ fullWidth: true, className: 'mt-7' })}
      >
        {copy.nav.cta}
      </Link>
    </div>
  );
}
