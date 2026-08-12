import {
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  smallint,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/mysql-core';

/**
 * What visitors send.
 *
 * Neither form exists in the handoff: the submit buttons are `<a href="#">` and the consent
 * checkbox is a styled `<span>`. Everything below is designed rather than transcribed, and the
 * two columns that matter most — `quoteSnapshot` and `passportNumber` — are both about not
 * trusting the client and not keeping more than necessary in the clear.
 */

export const leads = mysqlTable(
  'leads',
  {
    id: int().autoincrement().primaryKey(),
    /** The two tabs on the contact page. Also set by the builder's final step. */
    kind: mysqlEnum(['tour', 'question', 'builder']).notNull().default('question'),
    name: varchar({ length: 120 }).notNull(),
    /** E.164. Validated with libphonenumber before it gets here. */
    phone: varchar({ length: 24 }).notNull(),
    email: varchar({ length: 190 }),
    guests: smallint(),
    /** Interest codes, never the translated labels the chips display. */
    topics: json().$type<string[]>(),
    message: text(),
    /** Which language the visitor was reading, so the reply is written in it. */
    locale: varchar({ length: 5 }).notNull().default('ru'),
    /** The builder selection, by option code. */
    selection: json().$type<Record<string, string | string[]>>(),
    /**
     * The price, recalculated on the server at the moment of submission.
     *
     * Never what the client sent. A lead is a commercial commitment, and a number that arrived
     * from a browser is a number the sender chose.
     */
    quoteSnapshot: json(),
    /**
     * `hash(endpoint + phone)`, for the fifteen-minute duplicate window.
     *
     * A double-tapped submit button or an impatient second attempt produces one row and one
     * `leadId`, not two managers calling the same person. Decision D-19.
     */
    dedupeHash: varchar({ length: 64 }),
    status: mysqlEnum(['new', 'in_progress', 'won', 'lost', 'spam']).notNull().default('new'),
    adminNotes: text(),
    /** Hashed. An inbox should not double as a list of people's addresses. */
    ipHash: varchar({ length: 64 }),
    userAgent: varchar({ length: 255 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index('leads_status_idx').on(table.status, table.createdAt),
    index('leads_created_idx').on(table.createdAt),
    index('leads_dedupe_idx').on(table.dedupeHash, table.createdAt),
  ],
);

/**
 * A place on a pilgrimage.
 *
 * `passportNumber` is encrypted with AES-256-GCM before it reaches this column, the key lives
 * in the environment, the field is absent from every list response, and each decryption writes
 * a row to `audit_log`. It is the most sensitive thing this system stores and the handoff does
 * not mention it once. Decision D-18; the retention period and the wording of the consent are
 * question Q-13.
 */
export const umrahSignups = mysqlTable(
  'umrah_signups',
  {
    id: int().autoincrement().primaryKey(),
    tripId: int().notNull(),
    fullName: varchar({ length: 160 }).notNull(),
    /** E.164, `+993 6X XXXXXX` for the audience this form is written for. */
    phone: varchar({ length: 24 }).notNull(),
    /** Ciphertext, base64. Never a passport number in the clear, not even in a backup. */
    passportNumber: varchar({ length: 512 }),
    peopleCount: smallint().notNull().default(1),
    /** `single`, `double`, `triple`, `quad`. A code, so the chip label can be translated. */
    roomType: varchar({ length: 20 }),
    comment: text(),
    locale: varchar({ length: 5 }).notNull().default('tm'),
    /** When consent was given, which is the fact a retention policy is counted from. */
    consentAt: timestamp(),
    dedupeHash: varchar({ length: 64 }),
    status: mysqlEnum(['new', 'contacted', 'confirmed', 'cancelled', 'spam'])
      .notNull()
      .default('new'),
    adminNotes: text(),
    ipHash: varchar({ length: 64 }),
    userAgent: varchar({ length: 255 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index('umrah_signups_trip_idx').on(table.tripId, table.status),
    index('umrah_signups_created_idx').on(table.createdAt),
    index('umrah_signups_dedupe_idx').on(table.dedupeHash, table.createdAt),
  ],
);

export const leadTables = { leads, umrahSignups };
