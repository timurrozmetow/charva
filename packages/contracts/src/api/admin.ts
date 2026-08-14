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

/**
 * What a column is, as far as a form is concerned.
 *
 * The list lives here rather than in the API because both ends read it: the server derives it
 * from the Drizzle table, the admin renders a control from it. A kind the SPA has never heard
 * of is then a compile error and not a blank field somebody notices in production.
 */
export const FIELD_KINDS = [
  'int',
  /** An integer in minor units. Shown as money, stored as a whole number — decision D-24. */
  'money',
  'string',
  'text',
  'boolean',
  'enum',
  /** An instant. On the wire always ISO 8601 with an offset, never a local string. */
  'timestamp',
  /** A departure: UTC wall clock, formatted in Ashgabat and nowhere else — decision D-73. */
  'datetime',
  /** Translated text, one tab per language the site offers. */
  'localized',
  'json',
] as const;

export type FieldKind = (typeof FIELD_KINDS)[number];

export const adminFieldSchema = z.object({
  name: z.string(),
  kind: z.enum(FIELD_KINDS),
  /** Must be filled to create a row: `NOT NULL` with no database default. */
  required: z.boolean(),
  nullable: z.boolean(),
  /** The key and the two timestamps. Shown, never edited. */
  readOnly: z.boolean(),
  maxLength: z.number().int().nullable(),
  enumValues: z.array(z.string()).nullable(),
});

export type AdminField = z.infer<typeof adminFieldSchema>;

/**
 * A table the admin can edit, described well enough to build a screen from.
 *
 * This is what makes one list component and one form component serve twenty entities: the SPA
 * asks what the columns are instead of being told twenty times in TypeScript.
 */
export const adminResourceSchema = z.object({
  name: z.string(),
  site: z.enum(['choice', 'global', 'umrah']).nullable(),
  capability: z.enum(CAPABILITIES),
  fields: z.array(adminFieldSchema),
  search: z.array(z.string()),
  filters: z.array(z.string()),
  /** The table carries `sort_order`, so the list can be dragged. */
  orderable: z.boolean(),
});

export type AdminResourceMeta = z.infer<typeof adminResourceSchema>;

export const adminResourcesResponse = z.object({ resources: z.array(adminResourceSchema) });

/** Rows are shaped by their own table, so the envelope is all that can be said in advance. */
export const adminRowsMeta = z.object({
  page: z.number().int(),
  perPage: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  hasMore: z.boolean(),
});

export const adminOkResponse = z.object({ ok: z.literal(true) });

export const adminReorderRequest = z
  .object({
    items: z
      .array(z.object({ id: z.number().int(), sortOrder: z.number().int() }).strict())
      .min(1)
      .max(500),
  })
  .strict();

export type AdminReorderRequest = z.infer<typeof adminReorderRequest>;
