import { createHmac, randomBytes, randomUUID } from 'node:crypto';

/**
 * The refresh token: 48 random bytes, stored as a digest, rotated on every use.
 *
 * Deliberately not a JWT. A JWT would carry claims this does not need and would be verifiable
 * without touching the database — which is exactly the property a refresh token must not have,
 * because revocation is the whole reason it exists. The handoff proposes a single long-lived
 * JWT; under that design an admin who loses a laptop stays logged in until it expires.
 *
 * The column holds an HMAC rather than the token, so `admin_refresh_tokens` is not a list of
 * working sessions. The pepper is `ADMIN_REFRESH_SECRET`, kept apart from the JWT secret so
 * neither one compromises both halves of the session.
 */

/** 48 bytes: 384 bits of entropy, and base64url so it survives a `Set-Cookie` unescaped. */
const TOKEN_BYTES = 48;

export interface IssuedRefreshToken {
  /** Goes to the browser in a cookie. Never stored, never logged, never returned in a body. */
  token: string;
  /** Goes to the column. */
  digest: string;
  /** Ties every rotation of one login together, so reuse can revoke all of them at once. */
  familyId: string;
}

export function issueRefreshToken(
  secret: string,
  familyId: string = randomUUID(),
): IssuedRefreshToken {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  return { token, digest: refreshDigest(token, secret), familyId };
}

/**
 * The stored form of a token.
 *
 * Lookup happens by this digest, on a unique index — so the comparison MySQL performs is
 * against a value derived from a 384-bit secret, and there is nothing to guess a byte at a time.
 */
export function refreshDigest(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('hex');
}
