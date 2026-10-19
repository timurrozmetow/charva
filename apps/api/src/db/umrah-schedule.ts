import { eq } from 'drizzle-orm';

import { type Database, withDb } from './client';
import * as t from './schema';

/**
 * The operator's announced departures, as he dictated them.
 *
 * Not in the seeds, and that is the difference between this file and `owner-content.ts`. A tour
 * sheet is the product: it belongs in the repository, survives a rebuild and reaches the live
 * database through `db:content`. A departure schedule is not the product, it is the calendar —
 * it turns over every few weeks, the sixth group will be typed into the admin panel rather than
 * committed here, and a rebuild of the test catalogue has no business resurrecting November.
 * `backfill-hero-slides.ts` exists for the same reason and is the precedent (D-129).
 *
 * What it is for, then: the five dates arrived in one message, they are worth having somewhere a
 * second pair of eyes can check them against that message, and running the same thing twice must
 * not produce ten groups. Idempotent by departure date — the one thing about a group that cannot
 * change without it being a different group.
 *
 *   pnpm --filter @charva/api db:umrah-schedule
 *   node dist/umrah-schedule.js        # on the server, where the bundle is
 */

/**
 * Times of day, which the owner did not give and this file does not invent.
 *
 * He named dates. A `datetime` column needs a time, and the choice is not free: Turkmenistan is
 * UTC+5, so anything from 19:00 UTC onwards renders as the **next** calendar day in Ashgabat, and
 * the whole point of D-73 is that the date on the page is the date on the ticket. 04:00 and 07:00
 * UTC are 09:00 and 12:00 in Ashgabat — the same two times his own August group already carries
 * in this table, so this follows his precedent rather than setting a new one.
 *
 * The consequence is small and worth naming: the countdown on the homepage is accurate to within
 * a few hours of a real departure time nobody has stated. Over a three-week wait that is
 * invisible; the day it matters is the morning of the flight, and by then the group has its
 * tickets.
 */
const DEPART_TIME = '04:00:00';
const RETURN_TIME = '07:00:00';

/**
 * The size of a group he did not size, used twice and flagged both times.
 *
 * `umrah_trips_seats_range_chk` requires `seats_total > 0`, so there is no honest null. He gave
 * three numbers — 30, 20, 30 — and thirty is both the commonest and the one his open groups
 * carry, so it is what the fourth and fifth take until he says otherwise. It is the number most
 * worth confirming on the fifth: that one is still selling, and the badge reads «Набор открыт ·
 * N мест» — too low turns pilgrims away, too high oversells a flight.
 */
const ASSUMED_SEATS = 30;

interface Departure {
  /** `YYYY-MM-DD`, Ashgabat. */
  depart: string;
  return: string;
  /** What the owner called it, for the log — the table has no name column and needs none. */
  label: string;
  seatsTotal: number;
  /**
   * `full` is his word «заполненые»; `selling` is «нам нужны клиенты».
   *
   * A full group is written as every seat taken, which is what makes the page say «Группа
   * набрана» rather than inviting a booking it cannot honour. A selling group is written as
   * **zero** taken, and that is a deliberate understatement rather than a count: he said it needs
   * clients, not how many it already has, and a bar invented at a third full is a claim about
   * other people's bookings. Zero is the only number here that is his.
   */
  state: 'full' | 'selling';
}

/*
 * The five groups, in the order and with the dates the owner sent.
 *
 * One correction, and it is the only one: the fourth group was written «15.11.2026 gidish /
 * 29.10.2026 gaydysh», a return seventeen days before its own departure. The database refuses it
 * outright — `umrah_trips_dates_order_chk` is `return_at > depart_at` — so it could not be
 * entered as written whatever anyone decided. 29.11 is what it reads as: fourteen days, which is
 * exactly the third group's length, and a single digit away in the month. It is written here as
 * 29.11 and flagged to the owner rather than quietly rounded, because it is a date people book
 * flights around.
 */
const DEPARTURES: Departure[] = [
  {
    label: '1-nji topar',
    depart: '2026-10-16',
    return: '2026-10-31',
    seatsTotal: 30,
    state: 'full',
  },
  {
    label: '2-nji topar',
    depart: '2026-10-17',
    return: '2026-11-01',
    seatsTotal: 20,
    state: 'full',
  },
  // The two he is selling: «9-23 Ноябрь и Декабрь 2-17 нам нужны клиенты».
  {
    label: '3-nji topar',
    depart: '2026-11-09',
    return: '2026-11-23',
    seatsTotal: 30,
    state: 'selling',
  },
  // 29.11, not the 29.10 the message carried, and a size he did not state. See the notes above.
  {
    label: '4-nji topar',
    depart: '2026-11-15',
    return: '2026-11-29',
    seatsTotal: ASSUMED_SEATS,
    state: 'full',
  },
  {
    label: '5-nji topar',
    depart: '2026-12-02',
    return: '2026-12-17',
    seatsTotal: ASSUMED_SEATS,
    state: 'selling',
  },
];

/** Whole days between two `YYYY-MM-DD`, which is what the page prints as «N gün». */
function days(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/**
 * What to store in `status`, knowing the site does not read it.
 *
 * `deriveTripState` recomputes the state from the clock on every read (D-13), so the column only
 * has to be one of the visible five for the row to exist at all. It is still written truthfully:
 * the admin's lists sort by it, and a group in the air labelled «open» in the panel is the kind
 * of small lie that gets repeated to somebody on the phone.
 */
type ClockStatus = 'open' | 'full' | 'departed' | 'completed';

function statusAt(
  depart: string,
  returnOn: string,
  now: Date,
  seats?: { total: number; taken: number },
): ClockStatus {
  const stamp = now.toISOString().slice(0, 10);
  if (stamp >= returnOn) return 'completed';
  if (stamp >= depart) return 'departed';
  if (seats !== undefined && seats.taken >= seats.total) return 'full';
  return 'open';
}

export async function applySchedule(db: Database, now: Date = new Date()): Promise<number> {
  const existing = new Set(
    (await db.select({ departAt: t.umrahTrips.departAt }).from(t.umrahTrips)).map((row) =>
      row.departAt.slice(0, 10),
    ),
  );

  let written = 0;

  for (const trip of DEPARTURES) {
    if (existing.has(trip.depart)) {
      process.stdout.write(`  ${trip.label}: ${trip.depart} already there, left alone\n`);
      continue;
    }

    const seatsTaken = trip.state === 'full' ? trip.seatsTotal : 0;
    const status = statusAt(trip.depart, trip.return, now, {
      total: trip.seatsTotal,
      taken: seatsTaken,
    });

    await db.insert(t.umrahTrips).values({
      departAt: `${trip.depart} ${DEPART_TIME}`,
      returnAt: `${trip.return} ${RETURN_TIME}`,
      // Null, not a guess. He named no closing date, and a date here disables the form on it.
      signupClosesAt: null,
      seatsTotal: trip.seatsTotal,
      seatsTaken,
      durationDays: days(trip.depart, trip.return),
      // Null for both. Which hotel each group sleeps in is a fact about his bookings, and the
      // page omits the line rather than printing somebody else's hotel (D-137).
      hotelMekka: null,
      hotelMedina: null,
      status,
      // Never set from a script: the unique index allows one, and it is the owner's override to
      // spend. The site derives the current departure anyway (D-13).
      isCurrent: false,
      priceMinor: null,
    });

    process.stdout.write(
      `  ${trip.label}: ${trip.depart} → ${trip.return}, ` +
        `${String(days(trip.depart, trip.return))} gün, ` +
        `${String(seatsTaken)}/${String(trip.seatsTotal)} orun, ${status}\n`,
    );
    written += 1;
  }

  return written;
}

/**
 * Brings the stored label back in step with the clock for every group, new or old.
 *
 * The cron does this in production; running it here means the admin's list is right the minute
 * the schedule lands, rather than at the next tick.
 */
export async function refreshStatuses(db: Database, now: Date = new Date()): Promise<number> {
  const rows = await db
    .select({
      id: t.umrahTrips.id,
      departAt: t.umrahTrips.departAt,
      returnAt: t.umrahTrips.returnAt,
      status: t.umrahTrips.status,
      seatsTotal: t.umrahTrips.seatsTotal,
      seatsTaken: t.umrahTrips.seatsTaken,
    })
    .from(t.umrahTrips);

  let moved = 0;

  for (const row of rows) {
    // `draft` and `closed` are an editor's decisions and not this function's to overrule. The
    // other four are the clock's and the seat count's, which is exactly what it recomputes.
    if (!['open', 'full', 'departed', 'completed'].includes(row.status)) continue;

    const next = statusAt(row.departAt.slice(0, 10), row.returnAt.slice(0, 10), now, {
      total: row.seatsTotal,
      taken: row.seatsTaken,
    });
    if (next === row.status) continue;

    await db.update(t.umrahTrips).set({ status: next }).where(eq(t.umrahTrips.id, row.id));
    process.stdout.write(`  #${String(row.id)}: ${row.status} → ${next}\n`);
    moved += 1;
  }

  return moved;
}

async function main(): Promise<void> {
  await withDb(async (db) => {
    process.stdout.write('departures\n');
    const added = await applySchedule(db);
    process.stdout.write(`${String(added)} added\n\nstatuses\n`);
    const moved = await refreshStatuses(db);
    process.stdout.write(`${String(moved)} moved\n`);
  });
}

await main();
