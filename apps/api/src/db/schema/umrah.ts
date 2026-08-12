import {
  bigint,
  boolean,
  date,
  datetime,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  smallint,
  timestamp,
  tinyint,
  unique,
  varchar,
} from 'drizzle-orm/mysql-core';

import { type LocalizedColumn } from './shared';

/**
 * Charva Umrah — the pilgrimage side.
 *
 * One package, no prices on the public site. `umrah_trips.price_minor` exists for the admin
 * and is absent from every public response schema, which is what makes decision D-12
 * structural rather than a convention someone eventually forgets.
 */

const publishable = {
  isPublished: boolean('is_published').notNull().default(false),
  sortOrder: int('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
};

/**
 * A departure.
 *
 * This one row drives the countdown, the seats bar, the dates in eight places and the state of
 * the signup form. In the prototypes `2026-09-18T06:00:00Z` is hardcoded in three JavaScript
 * files and the formatted date is typed into eight more, so a postponed departure is a
 * fourteen-file edit that someone will get wrong.
 *
 * The current trip is *derived* — the soonest future departure that is open, full or closed —
 * and `isCurrent` exists only as a manual override. A flag an administrator must remember to
 * move is a flag that will be wrong in the week they are away. Decision D-13.
 */
export const umrahTrips = mysqlTable(
  'umrah_trips',
  {
    id: int().autoincrement().primaryKey(),
    /** UTC. Every displayed date and the whole countdown are computed from this. */
    departAt: datetime({ mode: 'string' }).notNull(),
    returnAt: datetime({ mode: 'string' }).notNull(),
    /** When the list closes. Between this and `departAt` the form is disabled, not hidden. */
    signupClosesAt: datetime({ mode: 'string' }),
    seatsTotal: smallint().notNull(),
    seatsTaken: smallint().notNull().default(0),
    durationDays: tinyint().notNull(),
    hotelMekka: json().$type<LocalizedColumn>(),
    hotelMedina: json().$type<LocalizedColumn>(),
    /**
     * Six states, including a real `departed`.
     *
     * The prototype has none: once the date passes, the countdown clamps to zeros and stays
     * there. Two of these have no design at all and will both occur in the first weeks —
     * question Q-4.
     */
    status: mysqlEnum(['draft', 'open', 'full', 'closed', 'departed', 'completed'])
      .notNull()
      .default('draft'),
    /** Manual override only. The derived rule is what the site normally follows. */
    isCurrent: boolean().notNull().default(false),
    /** Admin-only. Never appears in a public response schema — D-12. */
    priceMinor: bigint({ mode: 'number' }),
    priceCurrency: mysqlEnum(['USD', 'TMT']).notNull().default('TMT'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index('umrah_trips_status_idx').on(table.status, table.departAt),
    index('umrah_trips_depart_idx').on(table.departAt),
  ],
);

/** The ten days of «Maksatnama». The proposal has no table for them at all. */
export const umrahProgramDays = mysqlTable(
  'umrah_program_days',
  {
    id: int().autoincrement().primaryKey(),
    dayNumber: tinyint().notNull(),
    title: json().$type<LocalizedColumn>().notNull(),
    description: json().$type<LocalizedColumn>(),
    city: json().$type<LocalizedColumn>(),
    mediaId: int(),
    ...publishable,
  },
  (table) => [unique('umrah_program_days_number_uq').on(table.dayNumber)],
);

/**
 * Places visited on the pilgrimage.
 *
 * `city` is an enum of the four that exist in the data. The prototype hardcodes a list of
 * three filter chips and forgets Jidda, so a quarter of the places are unreachable; building
 * the filter from `SELECT DISTINCT` over this column makes that impossible — decision D-15.
 *
 * The `pack` column from the proposal is gone: it is a leftover of the three-tier pricing that
 * contradicts «one package», and D-9 deletes such things rather than commenting them out.
 */
export const ziyaratPlaces = mysqlTable(
  'ziyarat_places',
  {
    id: int().autoincrement().primaryKey(),
    slug: varchar({ length: 160 }).notNull(),
    name: json().$type<LocalizedColumn>().notNull(),
    description: json().$type<LocalizedColumn>(),
    city: mysqlEnum(['mekge', 'medine', 'bedir', 'jidda']).notNull(),
    /** «2 sagat», «Ýarym gün» — a phrase, not a number, and translated. */
    durationLabel: json().$type<LocalizedColumn>(),
    coverMediaId: int(),
    ...publishable,
  },
  (table) => [
    unique('ziyarat_places_slug_uq').on(table.slug),
    index('ziyarat_places_city_idx').on(table.city, table.isPublished),
    index('ziyarat_places_published_idx').on(table.isPublished, table.sortOrder),
  ],
);

/**
 * A group that has already travelled.
 *
 * Photo and video counts are deliberately absent. The prototype stores `videos: 4` beside
 * three clips and `photos: 38` beside eight captions; both are `COUNT(*)` here, and cannot
 * drift because there is nothing to drift from.
 */
export const umrahGroups = mysqlTable(
  'umrah_groups',
  {
    id: int().autoincrement().primaryKey(),
    slug: varchar({ length: 160 }).notNull(),
    tripId: int(),
    departedOn: date({ mode: 'string' }),
    pilgrimsCount: smallint(),
    label: json().$type<LocalizedColumn>().notNull(),
    shortLabel: json().$type<LocalizedColumn>(),
    description: json().$type<LocalizedColumn>(),
    coverMediaId: int(),
    ...publishable,
  },
  (table) => [
    unique('umrah_groups_slug_uq').on(table.slug),
    index('umrah_groups_departed_idx').on(table.departedOn),
    index('umrah_groups_published_idx').on(table.isPublished, table.sortOrder),
  ],
);

export const umrahGroupMedia = mysqlTable(
  'umrah_group_media',
  {
    id: int().autoincrement().primaryKey(),
    groupId: int().notNull(),
    kind: mysqlEnum(['photo', 'video']).notNull().default('photo'),
    mediaId: int().notNull(),
    posterMediaId: int(),
    caption: json().$type<LocalizedColumn>(),
    durationSec: int(),
    /** Editorial hints for the mosaic packer, same as the gallery. */
    spanCols: tinyint().notNull().default(1),
    spanRows: tinyint().notNull().default(1),
    sortOrder: int().notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('umrah_group_media_idx').on(table.groupId, table.kind, table.sortOrder),
    index('umrah_group_media_media_idx').on(table.mediaId),
  ],
);

export const umrahTables = {
  umrahTrips,
  umrahProgramDays,
  ziyaratPlaces,
  umrahGroups,
  umrahGroupMedia,
};
