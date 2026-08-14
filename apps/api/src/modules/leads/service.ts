import { type LeadRequest, type UmrahSignupRequest } from '@charva/contracts';
import { and, desc, eq, gt, sql } from 'drizzle-orm';

import { type Database } from '../../db/client';
import * as t from '../../db/schema';
import { type FormTokenVerdict, verifyFormToken } from '../../lib/form-token';
import { dedupeKey, hashIp } from '../../lib/hash';
import { parsePhone } from '../../lib/phone';
import { seal } from '../../lib/secret-box';
import { deriveTripState } from '../../lib/trip-status';
import { ApiProblem } from '../../plugins/error-handler';
import { priceSelection } from '../builder/service';

/**
 * The two forms, and the layers behind them.
 *
 * Neither exists in the handoff — the submit buttons are `<a href="#">` and the consent
 * checkbox is a styled `<span>` that cannot be checked. All of this is designed.
 *
 * Five stateless layers, no captcha (decision D-19). Turnstile would add a dependency on
 * Cloudflare, whose reachability from Turkmenistan nobody has verified, plus a consent surface
 * to explain on both sites — for a form that receives single digits of genuine traffic a day.
 * Order matters below: the cheapest and quietest checks run first, and nothing that rejects a
 * submission tells the sender what gave it away.
 */

/** How long two submissions from the same phone collapse into one. */
export const DEDUPE_WINDOW_MINUTES = 15;

export interface SubmissionMeta {
  ip: string;
  userAgent: string | undefined;
  locale: string;
  formTokenSecret: string;
  ipHashSecret: string;
  now?: Date;
}

/** `honeypot` means: answer 204 and write nothing. It is never an error. */
export type LeadOutcome =
  { kind: 'honeypot' } | { kind: 'stored'; id: number; isDuplicate: boolean };

/**
 * Layers two and three, which apply identically to both forms.
 *
 * The honeypot answers first and answers with silence. A rejection message is a lesson: a bot
 * that is told «поле website должно быть пустым» fills it in correctly next time, and the layer
 * is spent. So a filled honeypot produces the same shape of success a genuine submission does,
 * minus the row.
 */
function screen(
  input: { website?: string | undefined; formToken: string },
  meta: SubmissionMeta,
): 'honeypot' | 'ok' {
  if (input.website !== undefined && input.website.trim() !== '') return 'honeypot';

  const verdict = verifyFormToken(input.formToken, meta.formTokenSecret, meta.now?.getTime());
  if (verdict !== 'ok') throw tokenProblem(verdict);

  return 'ok';
}

/**
 * The time trap's four failures, and what each means to a person.
 *
 * `expired` is the one that happens to real visitors — a form left open over lunch — and it is
 * the only one whose message is written to be acted on, because the client can silently fetch a
 * new token and resubmit rather than losing what somebody typed.
 */
function tokenProblem(verdict: FormTokenVerdict): ApiProblem {
  const message =
    verdict === 'expired'
      ? 'The form has been open too long. Fetch a new token and resend.'
      : 'The form session could not be verified.';

  return new ApiProblem('validation_failed', message, [{ path: 'formToken', message: verdict }]);
}

/** Layer five: a number that cannot be dialled is a lead that cannot be answered. */
function requirePhone(raw: string): string {
  const parsed = parsePhone(raw);
  if (parsed === null) {
    throw new ApiProblem('validation_failed', 'That does not look like a phone number', [
      { path: 'phone', message: 'Expected a dialable number, for example +993 65 123456' },
    ]);
  }
  return parsed.e164;
}

/** Layer four: the same person, the same form, twice inside a quarter of an hour. */
async function findDuplicate(
  db: Database,
  table: typeof t.leads | typeof t.umrahSignups,
  hash: string,
  now: Date,
): Promise<number | undefined> {
  const since = new Date(now.getTime() - DEDUPE_WINDOW_MINUTES * 60_000);

  const [row] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.dedupeHash, hash), gt(table.createdAt, since)))
    .orderBy(desc(table.id))
    .limit(1);

  return row?.id;
}

// ----------------------------------------------------------------------------------------
// Global leads
// ----------------------------------------------------------------------------------------

export async function submitLead(
  db: Database,
  input: LeadRequest,
  meta: SubmissionMeta,
): Promise<LeadOutcome> {
  if (screen(input, meta) === 'honeypot') return { kind: 'honeypot' };

  const now = meta.now ?? new Date();
  const phone = requirePhone(input.phone);
  const hash = dedupeKey('global/leads', phone);

  const existing = await findDuplicate(db, t.leads, hash, now);
  if (existing !== undefined) return { kind: 'stored', id: existing, isDuplicate: true };

  /*
   * The price, recalculated here and nowhere else.
   *
   * `leadRequest` has no field for a total, so there is nothing to ignore — but the selection
   * is a client's, and this is where it becomes a number the business can stand behind.
   */
  const quoteSnapshot =
    input.selection === undefined ? null : await priceSelection(db, input.selection);

  const [result] = await db.insert(t.leads).values({
    kind: input.kind,
    name: input.name.trim(),
    phone,
    email: input.email ?? null,
    guests: input.guests ?? null,
    topics: input.topics ?? null,
    message: input.message ?? null,
    locale: meta.locale,
    // The date a retention policy is counted from. `leadRequest` types it as `true`, so there
    // is no branch here: a submission without it never reaches this function.
    consentAt: now,
    selection: input.selection ?? null,
    quoteSnapshot,
    dedupeHash: hash,
    ipHash: hashIp(meta.ip, meta.ipHashSecret),
    userAgent: meta.userAgent?.slice(0, 255) ?? null,
  });

  return { kind: 'stored', id: result.insertId, isDuplicate: false };
}

// ----------------------------------------------------------------------------------------
// Umrah signups
// ----------------------------------------------------------------------------------------

export interface SignupMeta extends SubmissionMeta {
  passportKey: string;
}

/**
 * A place on a pilgrimage.
 *
 * Two things happen here that do not happen on the Global form. The passport number is
 * encrypted before it reaches the column and is never returned by anything (decision D-18), and
 * the departure has to actually be open — the form being disabled in the browser is a courtesy,
 * not a rule, and a closed list that still accepts submissions produces people who believe they
 * are going.
 */
export async function submitSignup(
  db: Database,
  input: UmrahSignupRequest,
  meta: SignupMeta,
): Promise<LeadOutcome> {
  if (screen(input, meta) === 'honeypot') return { kind: 'honeypot' };

  const now = meta.now ?? new Date();
  const trip = await openTrip(db, now);
  const phone = requirePhone(input.phone);
  const hash = dedupeKey('umrah/signups', phone);

  const existing = await findDuplicate(db, t.umrahSignups, hash, now);
  if (existing !== undefined) return { kind: 'stored', id: existing, isDuplicate: true };

  const [result] = await db.insert(t.umrahSignups).values({
    tripId: trip.id,
    fullName: input.fullName.trim(),
    phone,
    passportNumber:
      input.passportNumber === undefined ? null : seal(input.passportNumber, meta.passportKey),
    peopleCount: input.peopleCount,
    roomType: input.roomType ?? null,
    comment: input.comment ?? null,
    locale: meta.locale,
    // The date a retention policy is counted from, which is why it is a moment and not a flag.
    // How long that period is, and what the consent must say, is question Q-13.
    consentAt: now,
    dedupeHash: hash,
    ipHash: hashIp(meta.ip, meta.ipHashSecret),
    userAgent: meta.userAgent?.slice(0, 255) ?? null,
  });

  return { kind: 'stored', id: result.insertId, isDuplicate: false };
}

/** The departure a signup attaches to, or a 409 explaining which of the five states blocked it. */
async function openTrip(db: Database, now: Date): Promise<typeof t.umrahTrips.$inferSelect> {
  const sqlNow = now.toISOString().slice(0, 19).replace('T', ' ');

  const [candidate] = await db
    .select()
    .from(t.umrahTrips)
    .where(
      and(
        sql`${t.umrahTrips.status} IN ('open', 'full', 'closed')`,
        gt(t.umrahTrips.departAt, sqlNow),
      ),
    )
    .orderBy(t.umrahTrips.departAt)
    .limit(1);

  if (candidate === undefined) {
    throw new ApiProblem('conflict', 'There is no announced departure to sign up for');
  }

  const state = deriveTripState(
    {
      departAt: new Date(`${candidate.departAt.replace(' ', 'T')}Z`),
      returnAt: new Date(`${candidate.returnAt.replace(' ', 'T')}Z`),
      signupClosesAt:
        candidate.signupClosesAt === null
          ? null
          : new Date(`${candidate.signupClosesAt.replace(' ', 'T')}Z`),
      seatsTotal: candidate.seatsTotal,
      seatsTaken: candidate.seatsTaken,
    },
    now,
  );

  if (!state.signupOpen) {
    throw new ApiProblem('conflict', `The list is not open: the departure is ${state.status}`, [
      { path: 'trip', message: state.status },
    ]);
  }

  return candidate;
}
