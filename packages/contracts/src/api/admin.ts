import { z } from 'zod';

import { ADMIN_ROLES, ADMIN_SITE_SCOPES, CAPABILITIES } from '../permissions';

/**
 * The admin session, on the wire.
 *
 * Two halves that are deliberately unlike each other. The access token is returned in the body
 * and lives in a JavaScript variable for fifteen minutes — never in `localStorage`, where any
 * script on the page can read it and where it survives the tab. The refresh token never appears
 * in a response body at all: it is set as a cookie the browser stores and this code cannot
 * read, scoped to the auth path, `SameSite=Strict` on an origin that serves no public pages
 * (decision D-20).
 *
 * So the thing that is long-lived is unreadable by script, and the thing readable by script is
 * short-lived. Neither property alone is worth much.
 */

export const adminUserSchema = z.object({
  id: z.number().int(),
  email: z.string(),
  name: z.string(),
  role: z.enum(ADMIN_ROLES),
  /** `null` means both sites. */
  siteScope: z.enum(ADMIN_SITE_SCOPES).nullable(),
  /**
   * Sent with the session so the SPA can hide what this account cannot do.
   *
   * Derived from the role by the same table the server enforces with, rather than re-derived in
   * the browser — one grant table, two readers.
   */
  capabilities: z.array(z.enum(CAPABILITIES)),
  lastLoginAt: z.string().nullable(),
});

export type AdminUser = z.infer<typeof adminUserSchema>;

export const adminLoginRequest = z
  .object({
    email: z.string().email().max(190),
    // No shape rules on the way in. Length or character requirements here would only tell an
    // attacker which guesses are not worth making; the rules that matter are on the way in at
    // account creation, in `create-admin.ts`.
    password: z.string().min(1).max(200),
  })
  .strict();

export type AdminLoginRequest = z.infer<typeof adminLoginRequest>;

export const adminSessionResponse = z.object({
  accessToken: z.string(),
  /** How long the token above is good for, so the SPA can refresh before it expires. */
  expiresInSeconds: z.number().int(),
  user: adminUserSchema,
});

export type AdminSessionResponse = z.infer<typeof adminSessionResponse>;

export const adminMeResponse = z.object({ user: adminUserSchema });

/**
 * Logout answers the same way whether or not there was a session.
 *
 * There is nothing to protect in the difference, and a client that has already lost its cookie
 * still wants the call to succeed so it can clear its own state.
 */
export const adminLogoutResponse = z.object({ ok: z.literal(true) });
