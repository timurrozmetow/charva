import {
  bigint,
  boolean,
  date,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  smallint,
  timestamp,
  tinyint,
  unique,
  varchar,
} from 'drizzle-orm/mysql-core';

import { type LocalizedColumn } from './shared';

/**
 * Charva Travel Global — the tour operator's catalogue.
 *
 * Everything here is published or not, ordered by hand, and translated into three languages.
 * Those three facts repeat on every table, so they repeat as the same three columns.
 */

const publishable = {
  isPublished: boolean('is_published').notNull().default(false),
  sortOrder: int('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
};

export const tours = mysqlTable(
  'tours',
  {
    id: int().autoincrement().primaryKey(),
    slug: varchar({ length: 160 }).notNull(),
    title: json().$type<LocalizedColumn>().notNull(),
    /** The card's one-line description. */
    summary: json().$type<LocalizedColumn>(),
    /** The detail page's body. No page exists in the design; phase 5 designs it. */
    body: json().$type<LocalizedColumn>(),
    /** The pill over the cover — «Хит», «Новинка». */
    tag: json().$type<LocalizedColumn>(),
    /** `classic`, `nature`, `history`, `culture`, `leisure`. A code, never a label — D-15. */
    category: varchar({ length: 40 }).notNull(),
    days: tinyint().notNull(),
    cities: tinyint().notNull(),
    /** 3 to 5, the hotel class this itinerary is priced against. */
    hotelStars: tinyint(),
    priceFromMinor: bigint({ mode: 'number' }).notNull(),
    priceCurrency: mysqlEnum(['USD', 'TMT']).notNull().default('USD'),
    coverMediaId: int(),
    isFeatured: boolean().notNull().default(false),
    ...publishable,
  },
  (table) => [
    unique('tours_slug_uq').on(table.slug),
    index('tours_published_idx').on(table.isPublished, table.sortOrder),
    index('tours_category_idx').on(table.category, table.isPublished),
    index('tours_featured_idx').on(table.isFeatured, table.isPublished),
  ],
);

/** The day-by-day itinerary on a tour's detail page. */
export const tourDays = mysqlTable(
  'tour_days',
  {
    id: int().autoincrement().primaryKey(),
    tourId: int().notNull(),
    dayNumber: tinyint().notNull(),
    title: json().$type<LocalizedColumn>().notNull(),
    description: json().$type<LocalizedColumn>(),
    city: json().$type<LocalizedColumn>(),
    mediaId: int(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => [unique('tour_days_number_uq').on(table.tourId, table.dayNumber)],
);

/** Photographs on a tour's detail page, beyond the cover. */
export const tourMedia = mysqlTable(
  'tour_media',
  {
    id: int().autoincrement().primaryKey(),
    tourId: int().notNull(),
    mediaId: int().notNull(),
    caption: json().$type<LocalizedColumn>(),
    sortOrder: int().notNull().default(0),
  },
  (table) => [
    unique('tour_media_uq').on(table.tourId, table.mediaId),
    index('tour_media_order_idx').on(table.tourId, table.sortOrder),
  ],
);

/**
 * Hotels.
 *
 * `stars` and `category` are separate columns because the design contradicts itself when they
 * are not. A yurt camp has no star rating, and the prototype shows it as «3★» in the card and
 * «Кемп» in the filter — two facts about one row that cannot both be true. The filter key is
 * derived: `category === 'hotel' ? stars + 'star' : category`.
 */
export const hotels = mysqlTable(
  'hotels',
  {
    id: int().autoincrement().primaryKey(),
    slug: varchar({ length: 160 }).notNull(),
    name: json().$type<LocalizedColumn>().notNull(),
    summary: json().$type<LocalizedColumn>(),
    body: json().$type<LocalizedColumn>(),
    city: json().$type<LocalizedColumn>().notNull(),
    /** 3, 4 or 5. Null for a boutique or a camp, which is the point of the pair. */
    stars: tinyint(),
    category: mysqlEnum(['hotel', 'boutique', 'camp']).notNull().default('hotel'),
    /** Per night. Kept apart from the builder's rates — decision D-22. */
    priceFromMinor: bigint({ mode: 'number' }).notNull(),
    priceCurrency: mysqlEnum(['USD', 'TMT']).notNull().default('USD'),
    /**
     * `14:00`. A wall-clock rule printed on a page, never a moment — so a string, not a TIME.
     */
    checkIn: varchar({ length: 5 }),
    checkOut: varchar({ length: 5 }),
    coverMediaId: int(),
    ...publishable,
  },
  (table) => [
    unique('hotels_slug_uq').on(table.slug),
    index('hotels_published_idx').on(table.isPublished, table.sortOrder),
    index('hotels_category_idx').on(table.category, table.stars),
  ],
);

/**
 * A hotel's photographs, beside its cover.
 *
 * The same shape as `tour_media`, and deliberately a second table rather than a shared one with
 * a `kind` column: the foreign key is what makes «every photograph of this hotel» a single
 * index lookup, and a polymorphic parent column cannot have one.
 */
export const hotelMedia = mysqlTable(
  'hotel_media',
  {
    id: int().autoincrement().primaryKey(),
    hotelId: int().notNull(),
    mediaId: int().notNull(),
    caption: json().$type<LocalizedColumn>(),
    sortOrder: int().notNull().default(0),
  },
  (table) => [
    unique('hotel_media_uq').on(table.hotelId, table.mediaId),
    index('hotel_media_order_idx').on(table.hotelId, table.sortOrder),
  ],
);

/**
 * Amenities as rows.
 *
 * The handoff proposes `hotels.amenities JSON` holding an array of Russian strings, which is
 * neither translatable nor filterable: «Бассейн» cannot become «Havuz», and no index can
 * answer "hotels with a pool".
 */
export const amenities = mysqlTable(
  'amenities',
  {
    id: int().autoincrement().primaryKey(),
    code: varchar({ length: 60 }).notNull(),
    name: json().$type<LocalizedColumn>().notNull(),
    icon: varchar({ length: 40 }),
    sortOrder: int().notNull().default(0),
  },
  (table) => [unique('amenities_code_uq').on(table.code)],
);

export const hotelAmenities = mysqlTable(
  'hotel_amenities',
  {
    hotelId: int().notNull(),
    amenityId: int().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.hotelId, table.amenityId] }),
    index('hotel_amenities_amenity_idx').on(table.amenityId),
  ],
);

/**
 * The kinds of room a hotel can offer — «1-комнатный», «Дуплекс», «Люкс».
 *
 * A dictionary rather than free text on each hotel, for the same reason amenities are a table:
 * the name is translated, and two editors typing «люкс» and «Люкс» produce two kinds of room
 * that no filter and no comparison can put back together. The code is what the rest of the
 * system holds, and it never changes after the first row references it (decision D-10).
 */
export const roomTypes = mysqlTable(
  'room_types',
  {
    id: int().autoincrement().primaryKey(),
    code: varchar({ length: 60 }).notNull(),
    name: json().$type<LocalizedColumn>().notNull(),
    sortOrder: int().notNull().default(0),
  },
  (table) => [unique('room_types_code_uq').on(table.code)],
);

/**
 * One kind of room, in one hotel, at its own price.
 *
 * Not a bare join like `hotel_amenities`: a room carries what it costs, how many people fit in
 * it and how big it is, and a hotel offering a duplex at one price and a suite at another is
 * the ordinary case. It has a surrogate key because the CRUD frame addresses rows by `id` —
 * `hotel_amenities` is excluded from the admin registry for lacking one — and because a hotel
 * genuinely may list the same type twice at different sizes.
 *
 * `priceMinor` is nullable and means «the hotel's own nightly price»: most hotels quote one
 * number, and forcing a price onto every room would make the catalogue's «от 96 $» disagree
 * with the room list underneath it.
 */
export const hotelRooms = mysqlTable(
  'hotel_rooms',
  {
    id: int().autoincrement().primaryKey(),
    hotelId: int().notNull(),
    roomTypeId: int().notNull(),
    /** How many people sleep in it. The one number a guest always asks for. */
    capacity: tinyint().notNull().default(2),
    /** Per night, in the hotel's own currency. Null falls back to `hotels.price_from_minor`. */
    priceMinor: bigint({ mode: 'number' }),
    sizeSqm: smallint(),
    description: json().$type<LocalizedColumn>(),
    coverMediaId: int(),
    sortOrder: int().notNull().default(0),
  },
  (table) => [
    index('hotel_rooms_hotel_idx').on(table.hotelId, table.sortOrder),
    index('hotel_rooms_type_idx').on(table.roomTypeId),
  ],
);

/**
 * Editorial articles.
 *
 * The handoff's proposal has no title column at all. Everything below is added.
 */
export const articles = mysqlTable(
  'articles',
  {
    id: int().autoincrement().primaryKey(),
    slug: varchar({ length: 160 }).notNull(),
    title: json().$type<LocalizedColumn>().notNull(),
    summary: json().$type<LocalizedColumn>(),
    body: json().$type<LocalizedColumn>(),
    tag: json().$type<LocalizedColumn>(),
    /** Shown as «6 мин чтения». Stored as a number so the unit can be translated. */
    readMinutes: tinyint(),
    coverMediaId: int(),
    isFeatured: boolean().notNull().default(false),
    publishedAt: timestamp(),
    ...publishable,
  },
  (table) => [
    unique('articles_slug_uq').on(table.slug),
    index('articles_published_idx').on(table.isPublished, table.publishedAt),
  ],
);

/**
 * Gallery tiles.
 *
 * `spanCols` and `spanRows` are an editor's opinion about which photograph deserves the room,
 * not a layout instruction: the packer treats them as a request and narrows anything that will
 * not fit. Decision D-16.
 */
export const galleryItems = mysqlTable(
  'gallery_items',
  {
    id: int().autoincrement().primaryKey(),
    mediaId: int().notNull(),
    caption: json().$type<LocalizedColumn>(),
    /** `nature`, `cities`, `history`, `culture`, `food`. */
    category: varchar({ length: 40 }).notNull(),
    spanCols: tinyint().notNull().default(1),
    spanRows: tinyint().notNull().default(1),
    ...publishable,
  },
  (table) => [
    index('gallery_published_idx').on(table.isPublished, table.sortOrder),
    index('gallery_category_idx').on(table.category, table.isPublished),
  ],
);

/**
 * Videos.
 *
 * `durationSec` is a number, not the `VARCHAR(10)` of the proposal: `14:20` is a rendering of
 * a duration in one locale, and it cannot be sorted, summed or re-formatted.
 *
 * `kind` survives the decision to self-host (Z-5) so that one clip can be put on an external
 * host later without a migration.
 */
export const videos = mysqlTable(
  'videos',
  {
    id: int().autoincrement().primaryKey(),
    slug: varchar({ length: 160 }).notNull(),
    title: json().$type<LocalizedColumn>().notNull(),
    description: json().$type<LocalizedColumn>(),
    kind: mysqlEnum(['file', 'youtube', 'vimeo']).notNull().default('file'),
    /** Set for `file`. The transcoded 720p copy, not the original. */
    mediaId: int(),
    /** Set for `youtube` and `vimeo`. */
    externalId: varchar({ length: 60 }),
    posterMediaId: int(),
    durationSec: int(),
    viewCount: int().notNull().default(0),
    category: varchar({ length: 40 }),
    isFeatured: boolean().notNull().default(false),
    ...publishable,
  },
  (table) => [
    unique('videos_slug_uq').on(table.slug),
    index('videos_published_idx').on(table.isPublished, table.sortOrder),
  ],
);

/**
 * Reviews.
 *
 * `visitedOn` is a DATE. The prototype stores «Май 2026» as a string, which is exactly why its
 * «Сначала новые» filter sorts nothing — and the aggregates it prints beside them (4,8 · 214 ·
 * 92%) are literals contradicting nine rows. Both become computed: `AVG`, `COUNT`, and
 * `COUNT(rating >= 4) / COUNT(*)`. Decision D-6.
 */
export const reviews = mysqlTable(
  'reviews',
  {
    id: int().autoincrement().primaryKey(),
    authorName: varchar({ length: 120 }).notNull(),
    authorCity: json().$type<LocalizedColumn>(),
    avatarMediaId: int(),
    rating: tinyint().notNull(),
    body: json().$type<LocalizedColumn>().notNull(),
    /** The month the visit happened. Day is set to the first; only month and year are shown. */
    visitedOn: date({ mode: 'string' }),
    tourId: int(),
    /** The tour's name as it was, for a review of an itinerary that no longer exists. */
    tourTitle: json().$type<LocalizedColumn>(),
    status: mysqlEnum(['pending', 'published', 'rejected']).notNull().default('pending'),
    ...publishable,
  },
  (table) => [
    index('reviews_status_idx').on(table.status, table.visitedOn),
    index('reviews_rating_idx').on(table.rating),
    index('reviews_tour_idx').on(table.tourId),
  ],
);

export const faqs = mysqlTable(
  'faqs',
  {
    id: int().autoincrement().primaryKey(),
    site: mysqlEnum(['choice', 'global', 'umrah']).notNull().default('global'),
    question: json().$type<LocalizedColumn>().notNull(),
    answer: json().$type<LocalizedColumn>().notNull(),
    ...publishable,
  },
  (table) => [index('faqs_site_idx').on(table.site, table.isPublished, table.sortOrder)],
);

/** Places on the Turkmenistan page — a real table, unlike the seven blocks D-17 collapses. */
export const placesToSee = mysqlTable(
  'places_to_see',
  {
    id: int().autoincrement().primaryKey(),
    slug: varchar({ length: 160 }).notNull(),
    name: json().$type<LocalizedColumn>().notNull(),
    region: json().$type<LocalizedColumn>(),
    description: json().$type<LocalizedColumn>(),
    coverMediaId: int(),
    ...publishable,
  },
  (table) => [
    unique('places_to_see_slug_uq').on(table.slug),
    index('places_to_see_published_idx').on(table.isPublished, table.sortOrder),
  ],
);

/** Re-exported so the migration generator sees a stable set. */
export const globalTables = {
  tours,
  tourDays,
  tourMedia,
  hotels,
  amenities,
  hotelAmenities,
  articles,
  galleryItems,
  videos,
  reviews,
  faqs,
  placesToSee,
};
