import { type Lang } from '@charva/contracts';
import {
  bigint,
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  smallint,
  text,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/mysql-core';

/**
 * Tables both sites share.
 *
 * Column names are snake_case in SQL and camelCase in TypeScript; the mapping is done once by
 * `casing: 'snake_case'` in the Drizzle config rather than by writing every name twice.
 */

/** Translatable columns are JSON — decision D-5. The shape is checked at the API boundary. */
export type LocalizedColumn = Partial<Record<Lang, string>>;

const timestamps = {
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
};

/**
 * Uploaded and stock images and video.
 *
 * `storageKey` is a relative key — `2026/07/a3f9…webp` — and never a URL. The URL is built
 * when the row is serialised, so moving from local disk to object storage is a change to one
 * adapter rather than an UPDATE across every row that ever referenced a file. Decision D-8.
 */
export const media = mysqlTable(
  'media',
  {
    id: int().autoincrement().primaryKey(),
    storageKey: varchar({ length: 255 }).notNull(),
    mime: varchar({ length: 100 }).notNull(),
    width: int(),
    height: int(),
    sizeBytes: bigint({ mode: 'number' }).notNull(),
    /** Video only. `videos.duration_sec` on the public row is denormalised from this. */
    durationSec: int(),
    /**
     * SHA-256 of the original bytes.
     *
     * Unique, so uploading the same photograph twice returns the existing row instead of
     * filling the disk with copies — the same picture will be attached to a tour, a gallery
     * tile and an OG card.
     */
    checksum: varchar({ length: 64 }).notNull(),
    /** Inline base64 preview, a few hundred bytes, shown blurred while the real file loads. */
    lqip: text(),
    /** Subject position, 0–1000 so it stays an integer. `Img` divides by a thousand. */
    focalX: smallint(),
    focalY: smallint(),
    /** Alternative text per language. Required before a slot may be marked done. */
    alt: json().$type<LocalizedColumn>(),
    source: mysqlEnum(['upload', 'stock', 'external']).notNull().default('upload'),
    /** Who to credit, for stock. Kept even after replacement, as a record of what was used. */
    attribution: varchar({ length: 255 }),
    license: varchar({ length: 120 }),
    /**
     * A stand-in that must not reach production.
     *
     * Decision D-25: deployment is blocked while any of these remain, which is why it is a
     * column and not a naming convention.
     */
    isPlaceholder: boolean().notNull().default(false),
    ...timestamps,
  },
  (table) => [
    unique('media_checksum_uq').on(table.checksum),
    index('media_placeholder_idx').on(table.isPlaceholder),
  ],
);

/**
 * Every photograph the design asks for, whether or not it exists yet.
 *
 * The single most important table in this schema, and it is not in the handoff's proposal at
 * all. There are around 151 `<image-slot>` elements carrying a sentence of Russian art
 * direction and no image; as rows they become a checklist with a status, the admin can show
 * what is still missing, and every page renders at its real proportions in the meantime.
 * Decision D-21, question Q-1.
 */
export const contentSlots = mysqlTable(
  'content_slots',
  {
    id: int().autoincrement().primaryKey(),
    site: mysqlEnum(['choice', 'global', 'umrah']).notNull(),
    /** Route the slot appears on — `home`, `tours`, `gallery`. */
    page: varchar({ length: 60 }).notNull(),
    /** `hero-1`, `tour-cover-3`. Referenced from markup, so it never changes once used. */
    slotKey: varchar({ length: 80 }).notNull(),
    /** The art direction, verbatim from the prototype. Russian; shown only in the admin. */
    brief: text().notNull(),
    recommendedWidth: int(),
    recommendedHeight: int(),
    /** Null while the photograph does not exist. That is the point of the table. */
    mediaId: int(),
    sortOrder: int().notNull().default(0),
    ...timestamps,
  },
  (table) => [
    unique('content_slots_key_uq').on(table.site, table.page, table.slotKey),
    index('content_slots_page_idx').on(table.site, table.page, table.sortOrder),
    index('content_slots_media_idx').on(table.mediaId),
  ],
);

/**
 * Seven small ordered lists, in one table.
 *
 * The Umrah package composition, its conditions, «Baha girýär», the signup order, the daily
 * routine, the country facts and the visa steps are the same shape: an ordered list of short
 * labelled items belonging to a page, joined to nothing, edited identically. Seven tables
 * would be seven CRUD screens for one interaction. Decision D-17.
 *
 * `places_to_see` stays a real table, because it has a slug, a cover and a body.
 */
export const contentBlocks = mysqlTable(
  'content_blocks',
  {
    id: int().autoincrement().primaryKey(),
    site: mysqlEnum(['choice', 'global', 'umrah']).notNull(),
    /** `umrah_package`, `umrah_conditions`, `country_facts`, `visa_steps`, `daily_routine`. */
    blockCode: varchar({ length: 60 }).notNull(),
    keyText: json().$type<LocalizedColumn>(),
    valueText: json().$type<LocalizedColumn>(),
    note: json().$type<LocalizedColumn>(),
    /** Name from the icon set, for the blocks the design gives icons to. */
    icon: varchar({ length: 40 }),
    mediaId: int(),
    /**
     * Country facts appear twice: eight on the Turkmenistan page and seven of them on the
     * homepage. One flag rather than a second table — that difference is the only difference.
     */
    isFeatured: boolean().notNull().default(false),
    /** Anything one block needs and the others do not. Typed per `blockCode` in contracts. */
    meta: json(),
    sortOrder: int().notNull().default(0),
    ...timestamps,
  },
  (table) => [index('content_blocks_code_idx').on(table.site, table.blockCode, table.sortOrder)],
);

/**
 * The slider at the top of both homepages — one photograph and one caption per slide.
 *
 * It exists because it did not, and the absence was visible from the outside. Global's slides
 * were the first four rows of `places_to_see` and Umrah's the first three of `ziyarat_places`;
 * the caption was the place's name, and the photograph was the place's cover *or* a `g-hero-N`
 * content slot, whichever happened to be filled. So a slide could not be renamed without
 * renaming a place on another page, could not be reordered without reordering that page, and
 * had two possible homes for its picture — which is why an upload sometimes did nothing.
 *
 * The design always had this list. The export carries `SLIDES` with a label and a brief per
 * slide, beside the separate `places` array, and Umrah's third slide is a group photograph that
 * is not a ziyarat place at all. Folding one list into the other was an invention.
 *
 * `brief` lives here rather than in `content_slots` so that the photograph has exactly one home.
 */
export const heroSlides = mysqlTable(
  'hero_slides',
  {
    id: int().autoincrement().primaryKey(),
    /** No `choice`: the chooser is two static halves, and has no slider to put a slide in. */
    site: mysqlEnum(['global', 'umrah']).notNull(),
    title: json().$type<LocalizedColumn>().notNull(),
    /** Art direction until a photograph exists — and the text `db:stock` matches against. */
    brief: text(),
    mediaId: int(),
    isPublished: boolean().notNull().default(true),
    sortOrder: int().notNull().default(0),
    ...timestamps,
  },
  (table) => [index('hero_slides_site_idx').on(table.site, table.isPublished, table.sortOrder)],
);

/** Contacts, social links, licence number, opening hours, default OG image. */
export const settings = mysqlTable(
  'settings',
  {
    id: int().autoincrement().primaryKey(),
    site: mysqlEnum(['choice', 'global', 'umrah']).notNull(),
    settingKey: varchar({ length: 80 }).notNull(),
    value: json().notNull(),
    ...timestamps,
  },
  (table) => [unique('settings_key_uq').on(table.site, table.settingKey)],
);

export const adminUsers = mysqlTable(
  'admin_users',
  {
    id: int().autoincrement().primaryKey(),
    email: varchar({ length: 190 }).notNull(),
    /** Argon2id. The parameters live in the hash string, so they can be raised over time. */
    passwordHash: varchar({ length: 255 }).notNull(),
    name: varchar({ length: 120 }).notNull(),
    role: mysqlEnum(['owner', 'editor', 'manager']).notNull().default('editor'),
    /** Which site this account may touch. Null means both. */
    siteScope: mysqlEnum(['global', 'umrah']),
    isActive: boolean().notNull().default(true),
    failedAttempts: int().notNull().default(0),
    /** Set after repeated failures, so a stolen address cannot be brute-forced overnight. */
    lockedUntil: timestamp(),
    lastLoginAt: timestamp(),
    ...timestamps,
  },
  (table) => [unique('admin_users_email_uq').on(table.email)],
);

/**
 * Refresh tokens, stored as digests.
 *
 * The handoff proposes a single JWT, which cannot be revoked: an admin who loses a laptop
 * stays logged in until the token expires. Rows can be revoked, and `familyId` is what makes
 * reuse detectable — presenting a token that has already been rotated revokes the whole
 * family, because either it was stolen or the client is broken, and both warrant a logout.
 */
export const adminRefreshTokens = mysqlTable(
  'admin_refresh_tokens',
  {
    id: int().autoincrement().primaryKey(),
    userId: int().notNull(),
    /** HMAC of the token. The token itself is never stored, only ever compared. */
    tokenHash: varchar({ length: 64 }).notNull(),
    familyId: varchar({ length: 36 }).notNull(),
    expiresAt: timestamp().notNull(),
    revokedAt: timestamp(),
    /** Hashed, not stored raw: an audit trail should not itself be a list of home addresses. */
    ipHash: varchar({ length: 64 }),
    userAgent: varchar({ length: 255 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    unique('admin_refresh_tokens_hash_uq').on(table.tokenHash),
    index('admin_refresh_tokens_family_idx').on(table.familyId),
    index('admin_refresh_tokens_user_idx').on(table.userId, table.expiresAt),
  ],
);

/**
 * Every write, and every read of a passport number.
 *
 * The second half is decision D-18 and is unusual on purpose: passport numbers are the most
 * sensitive thing this system holds, and «who looked at it» is the question that gets asked
 * after an incident, not before.
 */
export const auditLog = mysqlTable(
  'audit_log',
  {
    id: bigint({ mode: 'number' }).autoincrement().primaryKey(),
    actorId: int(),
    /** `create`, `update`, `delete`, `publish`, `reveal_passport`, `login`, `login_failed`. */
    action: varchar({ length: 40 }).notNull(),
    entity: varchar({ length: 60 }).notNull(),
    entityId: varchar({ length: 60 }),
    before: json(),
    after: json(),
    ipHash: varchar({ length: 64 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('audit_log_entity_idx').on(table.entity, table.entityId),
    index('audit_log_actor_idx').on(table.actorId, table.createdAt),
    index('audit_log_action_idx').on(table.action, table.createdAt),
  ],
);

/*
 * `schema_migrations` is deliberately absent.
 *
 * The ledger belongs to the runner in `db/migrate.ts`, which creates it before it reads it.
 * Declaring it here as well would put it in the generated DDL, and the first migration would
 * then try to create a table the runner had just created.
 */
