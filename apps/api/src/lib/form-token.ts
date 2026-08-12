import { createHmac } from 'node:crypto';

import { constantTimeEqual } from './hash';

/**
 * The time trap — anti-spam layer three, and the one that costs a visitor nothing.
 *
 * `GET /forms/token` hands out a signed timestamp; the form sends it back on submit. A
 * submission that arrives less than three seconds after the form was rendered was not typed by
 * a person, and one that arrives more than two hours later was made against a page that has
 * been sitting open long enough for the rest of the defences to be stale.
 *
 * The signature is what makes this stateless. The server does not remember having issued
 * anything: it re-computes the HMAC and either the timestamp is one it signed or it is not.
 * No session, no cookie, no table, no expiry job — which matters because a captcha was ruled
 * out (D-19) and each remaining layer has to be cheap enough to justify itself.
 */

/** Below this, nobody filled in a form. Three seconds is slower than any script and faster
 * than any human who has actually read the labels. */
export const MIN_FILL_SECONDS = 3;

/** Above this the page has been open long enough that we would rather it were reloaded. */
export const MAX_FILL_SECONDS = 2 * 60 * 60;

export interface FormToken {
  token: string;
  /** So the client can reload the form before it expires rather than losing what was typed. */
  expiresInSeconds: number;
}

function sign(issuedAt: number, secret: string): string {
  return createHmac('sha256', secret).update(String(issuedAt)).digest('base64url');
}

/** Issues a token for a form rendered now. `now` is a parameter so tests can control it. */
export function issueFormToken(secret: string, now: number = Date.now()): FormToken {
  const issuedAt = Math.floor(now / 1000);
  return {
    token: `${String(issuedAt)}.${sign(issuedAt, secret)}`,
    expiresInSeconds: MAX_FILL_SECONDS,
  };
}

export type FormTokenVerdict = 'ok' | 'malformed' | 'bad_signature' | 'too_fast' | 'expired';

/**
 * Checks a token against the clock.
 *
 * Every failure is a distinct verdict because the caller logs which layer fired — knowing that
 * a week's rejections were all `too_fast` says the traps are working, and knowing they were all
 * `expired` says the window is too short and real people are losing what they typed.
 */
export function verifyFormToken(
  token: string,
  secret: string,
  now: number = Date.now(),
): FormTokenVerdict {
  const separator = token.indexOf('.');
  if (separator <= 0) return 'malformed';

  const issuedAtText = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  const issuedAt = Number(issuedAtText);
  if (!Number.isSafeInteger(issuedAt) || issuedAt <= 0) return 'malformed';

  if (!constantTimeEqual(signature, sign(issuedAt, secret))) return 'bad_signature';

  const elapsed = Math.floor(now / 1000) - issuedAt;
  // A negative elapsed time means a token signed for the future — possible only if the server
  // clock moved backwards, and indistinguishable from a forgery from here.
  if (elapsed < MIN_FILL_SECONDS) return 'too_fast';
  if (elapsed > MAX_FILL_SECONDS) return 'expired';

  return 'ok';
}
