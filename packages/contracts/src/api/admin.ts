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

// --------------------------------------------------------------------------------------------
// The media library
// --------------------------------------------------------------------------------------------

/**
 * A stored file, as the library screen shows it.
 *
 * `url` is assembled when the row is serialised and is never a column: `media.storage_key` holds
 * a relative key, which is what makes moving to object storage one adapter rather than an
 * UPDATE across every row that ever referenced a picture (decision D-8).
 */
export const adminMediaSchema = z.object({
  id: z.number().int(),
  storageKey: z.string(),
  url: z.string(),
  mime: z.string(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  sizeBytes: z.number().int(),
  /** Video only. Read from the file by ffprobe, never typed by hand. */
  durationSec: z.number().int().nullable(),
  /** Inline blurred preview, a few hundred bytes. */
  lqip: z.string().nullable(),
  focalX: z.number().int().nullable(),
  focalY: z.number().int().nullable(),
  alt: z.record(z.string(), z.string()).nullable(),
  source: z.enum(['upload', 'stock', 'external']),
  attribution: z.string().nullable(),
  license: z.string().nullable(),
  /** Blocks deployment while any remain — decision D-25. */
  isPlaceholder: z.boolean(),
  createdAt: z.string(),
});

export type AdminMedia = z.infer<typeof adminMediaSchema>;

export const adminMediaListResponse = z.object({
  items: z.array(adminMediaSchema),
  meta: adminRowsMeta,
});

export const adminUploadResponse = z.object({
  media: adminMediaSchema,
  /** Video only: the frame the player shows before it is pressed. */
  poster: adminMediaSchema.nullable(),
  /** The checksum already existed, so nothing new was written and this is the row it matched. */
  isDuplicate: z.boolean(),
});

export const adminMediaPatch = z
  .object({
    alt: z.record(z.string(), z.string()).nullable().optional(),
    /** 0–1000 rather than a fraction, so it stays an integer. `Img` divides by a thousand. */
    focalX: z.number().int().min(0).max(1000).nullable().optional(),
    focalY: z.number().int().min(0).max(1000).nullable().optional(),
    attribution: z.string().max(255).nullable().optional(),
    license: z.string().max(120).nullable().optional(),
    isPlaceholder: z.boolean().optional(),
  })
  .strict();

// --------------------------------------------------------------------------------------------
// The photograph checklist
// --------------------------------------------------------------------------------------------

/**
 * One of the 174 places a photograph is supposed to go.
 *
 * This is the screen that turns «there are no photographs» from an undocumented blocker into a
 * list somebody can work through — decision D-21, question Q-1. `brief` is the art direction
 * copied verbatim out of the prototype's `<image-slot>`.
 */
export const adminSlotSchema = z.object({
  id: z.number().int(),
  site: z.enum(['choice', 'global', 'umrah']),
  page: z.string(),
  slotKey: z.string(),
  brief: z.string(),
  recommendedWidth: z.number().int().nullable(),
  recommendedHeight: z.number().int().nullable(),
  sortOrder: z.number().int(),
  /** Null while the photograph does not exist, which is the entire point of the table. */
  media: adminMediaSchema.nullable(),
});

export type AdminSlot = z.infer<typeof adminSlotSchema>;

export const adminSlotsResponse = z.object({
  items: z.array(adminSlotSchema),
  meta: adminRowsMeta,
  /** How far off Q-1 is, counted rather than estimated. */
  progress: z.object({ filled: z.number().int(), total: z.number().int() }),
});

export type AdminSlotsResponse = z.infer<typeof adminSlotsResponse>;

export const adminAttachSlotRequest = z
  .object({ mediaId: z.number().int().positive().nullable() })
  .strict();

// --------------------------------------------------------------------------------------------
// The inbox
// --------------------------------------------------------------------------------------------

export const LEAD_STATUSES = ['new', 'in_progress', 'won', 'lost', 'spam'] as const;
export const SIGNUP_STATUSES = ['new', 'contacted', 'confirmed', 'cancelled', 'spam'] as const;

/**
 * An enquiry, as the inbox shows it.
 *
 * `quoteSnapshot` is the price the *server* worked out at the moment of submission, never a
 * number that arrived from a browser — so the figure the manager quotes on the phone is the one
 * the business actually stands behind.
 */
export const adminLeadSchema = z.object({
  id: z.number().int(),
  kind: z.enum(['tour', 'question', 'builder']),
  name: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  guests: z.number().int().nullable(),
  topics: z.array(z.string()).nullable(),
  message: z.string().nullable(),
  locale: z.string(),
  consentAt: z.string().nullable(),
  selection: z.record(z.string(), z.unknown()).nullable(),
  quoteSnapshot: z.unknown().nullable(),
  status: z.enum(LEAD_STATUSES),
  adminNotes: z.string().nullable(),
  createdAt: z.string(),
});

export type AdminLead = z.infer<typeof adminLeadSchema>;

export const adminLeadsResponse = z.object({
  items: z.array(adminLeadSchema),
  meta: adminRowsMeta,
});

export type AdminLeadsResponse = z.infer<typeof adminLeadsResponse>;

/**
 * A signup, with the passport deliberately missing.
 *
 * `hasPassport` says whether there is one to ask for; the number itself never appears in a list
 * response, at any privilege level. Reading it is a separate, logged action — decision D-18.
 */
export const adminSignupSchema = z.object({
  id: z.number().int(),
  tripId: z.number().int(),
  fullName: z.string(),
  phone: z.string(),
  hasPassport: z.boolean(),
  peopleCount: z.number().int(),
  roomType: z.string().nullable(),
  comment: z.string().nullable(),
  locale: z.string(),
  consentAt: z.string().nullable(),
  status: z.enum(SIGNUP_STATUSES),
  adminNotes: z.string().nullable(),
  createdAt: z.string(),
});

export type AdminSignup = z.infer<typeof adminSignupSchema>;

export const adminSignupsResponse = z.object({
  items: z.array(adminSignupSchema),
  meta: adminRowsMeta,
});

export type AdminSignupsResponse = z.infer<typeof adminSignupsResponse>;

export const adminLeadPatch = z
  .object({
    status: z.enum(LEAD_STATUSES).optional(),
    adminNotes: z.string().max(4000).nullable().optional(),
  })
  .strict();

export const adminSignupPatch = z
  .object({
    status: z.enum(SIGNUP_STATUSES).optional(),
    adminNotes: z.string().max(4000).nullable().optional(),
  })
  .strict();

/**
 * The answer to «show me the passport number», which is a request that gets written down.
 *
 * A POST rather than a GET because it has an effect — a row in `audit_log` — and because a GET
 * would end up in browser history, in a proxy log and in whatever prefetches links.
 */
export const adminPassportResponse = z.object({
  passportNumber: z.string(),
  /** Echoed back so the screen can say «this was recorded», rather than implying it was not. */
  recordedAt: z.string(),
});

export const adminRevealPassportRequest = z
  .object({
    /** Why it is being read. Written to the log beside who read it. */
    reason: z.string().min(3).max(200),
  })
  .strict();
