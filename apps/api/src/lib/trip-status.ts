import { type UmrahTripStatus } from '@charva/contracts';

/**
 * What state a departure is actually in — decision D-13.
 *
 * Derived from the clock and the seat count every time it is read, rather than trusted from the
 * column. The column is written by a cron so that the admin's lists sort correctly, but the
 * site reads this: if the cron has been dead for a week, an administrator sees a stale label in
 * one screen, and a visitor still sees the truth on every page.
 *
 * The prototype has none of this. Once the hardcoded date passes, its countdown clamps to zeros
 * and stays there — «00 дней 00 часов» over a signup form that still accepts submissions.
 *
 * Two of the five states have no design at all, and both occur within weeks of launch: a group
 * in the air, and no announced departure at all. Question Q-4.
 */

export interface TripTiming {
  departAt: Date;
  returnAt: Date;
  signupClosesAt: Date | null;
  seatsTotal: number;
  seatsTaken: number;
}

export interface TripState {
  status: UmrahTripStatus;
  /** Whether the form accepts submissions. Only ever true in `open`. */
  signupOpen: boolean;
  seatsLeft: number;
  /** 33 of 45 is 73.3, not the literal 73 the prototype draws beside that very caption. */
  seatsPercent: number;
}

export function deriveTripState(trip: TripTiming, now: Date = new Date()): TripState {
  const seatsLeft = Math.max(0, trip.seatsTotal - trip.seatsTaken);
  const seatsPercent =
    trip.seatsTotal <= 0
      ? 0
      : Math.round(Math.min(100, (trip.seatsTaken / trip.seatsTotal) * 100) * 10) / 10;

  const status = statusOf(trip, now);
  return { status, signupOpen: status === 'open', seatsLeft, seatsPercent };
}

/**
 * Latest applicable state wins.
 *
 * A departure that is both full and past its closing date is `closed`, not `full` — the later
 * fact is the one that decides what the form does, and a visitor being told «мест нет» when the
 * real reason is that the list shut a week ago is an answer they cannot act on.
 */
function statusOf(trip: TripTiming, now: Date): UmrahTripStatus {
  if (now >= trip.returnAt) return 'completed';
  if (now >= trip.departAt) return 'departed';
  if (trip.signupClosesAt !== null && now >= trip.signupClosesAt) return 'closed';
  if (trip.seatsTaken >= trip.seatsTotal) return 'full';
  return 'open';
}
