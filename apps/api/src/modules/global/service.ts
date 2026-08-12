import {
  type ContentBlockItem,
  type ContentSlot,
  type Facet,
  type Lang,
  pageMeta,
  pageSlice,
  type SiteSettings,
} from '@charva/contracts';
import { and, asc, avg, count, desc, eq, inArray, ne, sql } from 'drizzle-orm';

import { type Database } from '../../db/client';
import * as t from '../../db/schema';
import {
  blockItem,
  hotelFilterKey,
  isoOrNull,
  loadMedia,
  type MediaContext,
  mediaRef,
  slotItem,
  text,
} from '../../lib/serialize';
import { notFound } from '../../plugins/error-handler';

/**
 * Reading the Global catalogue.
 *
 * Two rules run through every function here. Nothing published is trusted to a stored counter —
 * «32 маршрута», «46 отелей», «214 отзывов» and «92% советуют» are all `COUNT` and `AVG` over
 * the rows actually on the page (decision D-6), because two numbers for one fact is one too
 * many and the prototype's two already disagree. And no filter list is written down: every chip
 * comes from a `GROUP BY` over published rows (D-15), so a chip cannot exist without rows behind
 * it and rows cannot exist without a chip that reaches them.
 */

export interface Context {
  db: Database;
  lang: Lang;
  baseUrl: string;
}

async function mediaContext(
  context: Context,
  ids: readonly (number | null | undefined)[],
): Promise<MediaContext> {
  return { baseUrl: context.baseUrl, lang: context.lang, byId: await loadMedia(context.db, ids) };
}

const published = eq(t.tours.isPublished, true);

// ----------------------------------------------------------------------------------------
// Tours
// ----------------------------------------------------------------------------------------

type TourRow = typeof t.tours.$inferSelect;

function tourCard(row: TourRow, media: MediaContext, lang: Lang) {
  return {
    id: row.id,
    slug: row.slug,
    title: text(row.title, lang),
    summary: text(row.summary, lang),
    tag: text(row.tag, lang),
    category: row.category,
    days: row.days,
    cities: row.cities,
    hotelStars: row.hotelStars,
    priceFrom: { minor: row.priceFromMinor, currency: row.priceCurrency },
    cover: mediaRef(row.coverMediaId, media),
    isFeatured: row.isFeatured,
  };
}

const TOUR_ORDER = {
  popular: [asc(t.tours.sortOrder), asc(t.tours.id)],
  price_asc: [asc(t.tours.priceFromMinor)],
  price_desc: [desc(t.tours.priceFromMinor)],
  days_asc: [asc(t.tours.days)],
  days_desc: [desc(t.tours.days)],
} as const;

export interface ToursQuery {
  page: number;
  perPage: number;
  category?: string | undefined;
  sort: keyof typeof TOUR_ORDER;
}

export async function listTours(context: Context, query: ToursQuery) {
  const { db, lang } = context;
  const where =
    query.category === undefined ? published : and(published, eq(t.tours.category, query.category));

  const { limit, offset } = pageSlice(query);

  const [rows, [total], facets] = await Promise.all([
    db
      .select()
      .from(t.tours)
      .where(where)
      .orderBy(...TOUR_ORDER[query.sort])
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(t.tours).where(where),
    // The facet counts are over *all* published tours, not the filtered set: a chip that says
    // how many rows it would show has to keep saying it while a different chip is active.
    db
      .select({ code: t.tours.category, value: count() })
      .from(t.tours)
      .where(published)
      .groupBy(t.tours.category)
      .orderBy(desc(count())),
  ]);

  const media = await mediaContext(
    context,
    rows.map((row) => row.coverMediaId),
  );

  return {
    items: rows.map((row) => tourCard(row, media, lang)),
    meta: pageMeta(query, total?.value ?? 0),
    facets: { categories: facets.map(toFacet) },
  };
}

export async function getTour(context: Context, slug: string) {
  const { db, lang } = context;

  const [tour] = await db
    .select()
    .from(t.tours)
    .where(and(published, eq(t.tours.slug, slug)))
    .limit(1);

  if (tour === undefined) throw notFound(`Tour «${slug}»`);

  const [days, gallery, related] = await Promise.all([
    db
      .select()
      .from(t.tourDays)
      .where(eq(t.tourDays.tourId, tour.id))
      .orderBy(asc(t.tourDays.dayNumber)),
    db
      .select()
      .from(t.tourMedia)
      .where(eq(t.tourMedia.tourId, tour.id))
      .orderBy(asc(t.tourMedia.sortOrder)),
    db
      .select()
      .from(t.tours)
      .where(and(published, eq(t.tours.category, tour.category), ne(t.tours.id, tour.id)))
      .orderBy(asc(t.tours.sortOrder))
      .limit(3),
  ]);

  const media = await mediaContext(context, [
    tour.coverMediaId,
    ...days.map((day) => day.mediaId),
    ...gallery.map((item) => item.mediaId),
    ...related.map((row) => row.coverMediaId),
  ]);

  return {
    ...tourCard(tour, media, lang),
    body: text(tour.body, lang),
    itinerary: days.map((day) => ({
      dayNumber: day.dayNumber,
      title: text(day.title, lang),
      description: text(day.description, lang),
      city: text(day.city, lang),
      media: mediaRef(day.mediaId, media),
    })),
    gallery: gallery.flatMap((item) => {
      const picture = mediaRef(item.mediaId, media);
      // A row pointing at a media id that no longer exists is a broken reference, not an empty
      // frame: dropping it is better than rendering a hole in the middle of a gallery.
      return picture === null ? [] : [{ caption: text(item.caption, lang), media: picture }];
    }),
    related: related.map((row) => tourCard(row, media, lang)),
  };
}

// ----------------------------------------------------------------------------------------
// Hotels
// ----------------------------------------------------------------------------------------

type HotelRow = typeof t.hotels.$inferSelect;

const hotelPublished = eq(t.hotels.isPublished, true);

const HOTEL_ORDER = {
  popular: [asc(t.hotels.sortOrder), asc(t.hotels.id)],
  price_asc: [asc(t.hotels.priceFromMinor)],
  price_desc: [desc(t.hotels.priceFromMinor)],
  stars_desc: [desc(t.hotels.stars)],
} as const;

export interface HotelsQuery {
  page: number;
  perPage: number;
  filter?: string | undefined;
  sort: keyof typeof HOTEL_ORDER;
}

/** Amenity rows for a set of hotels, in one query rather than one per card. */
async function amenitiesByHotel(
  db: Database,
  hotelIds: readonly number[],
  lang: Lang,
): Promise<Map<number, { code: string; name: string; icon: string | null }[]>> {
  const grouped = new Map<number, { code: string; name: string; icon: string | null }[]>();
  if (hotelIds.length === 0) return grouped;

  const rows = await db
    .select({
      hotelId: t.hotelAmenities.hotelId,
      code: t.amenities.code,
      name: t.amenities.name,
      icon: t.amenities.icon,
      sortOrder: t.amenities.sortOrder,
    })
    .from(t.hotelAmenities)
    .innerJoin(t.amenities, eq(t.amenities.id, t.hotelAmenities.amenityId))
    .where(inArray(t.hotelAmenities.hotelId, [...hotelIds]))
    .orderBy(asc(t.amenities.sortOrder));

  for (const row of rows) {
    const list = grouped.get(row.hotelId) ?? [];
    list.push({ code: row.code, name: text(row.name, lang), icon: row.icon });
    grouped.set(row.hotelId, list);
  }
  return grouped;
}

function hotelCard(
  row: HotelRow,
  media: MediaContext,
  lang: Lang,
  amenities: { code: string; name: string; icon: string | null }[],
) {
  return {
    id: row.id,
    slug: row.slug,
    name: text(row.name, lang),
    summary: text(row.summary, lang),
    city: text(row.city, lang),
    stars: row.stars,
    category: row.category,
    filterKey: hotelFilterKey(row.category, row.stars),
    priceFrom: { minor: row.priceFromMinor, currency: row.priceCurrency },
    cover: mediaRef(row.coverMediaId, media),
    amenities,
  };
}

/**
 * The hotel facets, built from the derived filter key.
 *
 * Grouping happens in JavaScript rather than in SQL because the key is a function of two
 * columns — `category` and `stars` — and expressing that as a `GROUP BY` expression would put
 * the rule in two places. There are nine hotels; there will not be nine hundred.
 */
function hotelFacets(rows: readonly { category: string; stars: number | null }[]): Facet[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = hotelFilterKey(row.category, row.stars);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([code, value]) => ({ code, label: code, count: value }))
    .sort((a, b) => b.count - a.count || (a.code < b.code ? -1 : 1));
}

export async function listHotels(context: Context, query: HotelsQuery) {
  const { db, lang } = context;

  // Every published hotel, so the facets can be counted and the filter applied on the derived
  // key. Nine rows today, and the ceiling is what an operator can photograph and describe.
  const all = await db
    .select()
    .from(t.hotels)
    .where(hotelPublished)
    .orderBy(...HOTEL_ORDER[query.sort]);

  const matching =
    query.filter === undefined
      ? all
      : all.filter((row) => hotelFilterKey(row.category, row.stars) === query.filter);

  const { limit, offset } = pageSlice(query);
  const rows = matching.slice(offset, offset + limit);

  const [media, amenities] = await Promise.all([
    mediaContext(
      context,
      rows.map((row) => row.coverMediaId),
    ),
    amenitiesByHotel(
      db,
      rows.map((row) => row.id),
      lang,
    ),
  ]);

  return {
    items: rows.map((row) => hotelCard(row, media, lang, amenities.get(row.id) ?? [])),
    meta: pageMeta(query, matching.length),
    facets: { categories: hotelFacets(all) },
  };
}

export async function getHotel(context: Context, slug: string) {
  const { db, lang } = context;

  const [hotel] = await db
    .select()
    .from(t.hotels)
    .where(and(hotelPublished, eq(t.hotels.slug, slug)))
    .limit(1);

  if (hotel === undefined) throw notFound(`Hotel «${slug}»`);

  const [media, amenities] = await Promise.all([
    mediaContext(context, [hotel.coverMediaId]),
    amenitiesByHotel(db, [hotel.id], lang),
  ]);

  return {
    ...hotelCard(hotel, media, lang, amenities.get(hotel.id) ?? []),
    body: text(hotel.body, lang),
  };
}

// ----------------------------------------------------------------------------------------
// Articles
// ----------------------------------------------------------------------------------------

type ArticleRow = typeof t.articles.$inferSelect;

const articlePublished = eq(t.articles.isPublished, true);

function articleCard(row: ArticleRow, media: MediaContext, lang: Lang) {
  return {
    id: row.id,
    slug: row.slug,
    title: text(row.title, lang),
    summary: text(row.summary, lang),
    tag: text(row.tag, lang),
    readMinutes: row.readMinutes,
    publishedAt: isoOrNull(row.publishedAt),
    cover: mediaRef(row.coverMediaId, media),
    isFeatured: row.isFeatured,
  };
}

export async function listArticles(context: Context, query: { page: number; perPage: number }) {
  const { db, lang } = context;
  const { limit, offset } = pageSlice(query);

  const [rows, [total]] = await Promise.all([
    db
      .select()
      .from(t.articles)
      .where(articlePublished)
      .orderBy(desc(t.articles.publishedAt), asc(t.articles.sortOrder))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(t.articles).where(articlePublished),
  ]);

  const media = await mediaContext(
    context,
    rows.map((row) => row.coverMediaId),
  );

  return {
    items: rows.map((row) => articleCard(row, media, lang)),
    meta: pageMeta(query, total?.value ?? 0),
  };
}

export async function getArticle(context: Context, slug: string) {
  const { db, lang } = context;

  const [article] = await db
    .select()
    .from(t.articles)
    .where(and(articlePublished, eq(t.articles.slug, slug)))
    .limit(1);

  if (article === undefined) throw notFound(`Article «${slug}»`);

  const related = await db
    .select()
    .from(t.articles)
    .where(and(articlePublished, ne(t.articles.id, article.id)))
    .orderBy(desc(t.articles.publishedAt))
    .limit(3);

  const media = await mediaContext(context, [
    article.coverMediaId,
    ...related.map((row) => row.coverMediaId),
  ]);

  return {
    ...articleCard(article, media, lang),
    body: text(article.body, lang),
    related: related.map((row) => articleCard(row, media, lang)),
  };
}

// ----------------------------------------------------------------------------------------
// Gallery and video
// ----------------------------------------------------------------------------------------

const galleryPublished = eq(t.galleryItems.isPublished, true);

export async function listGallery(
  context: Context,
  query: { page: number; perPage: number; category?: string | undefined },
) {
  const { db, lang } = context;
  const where =
    query.category === undefined
      ? galleryPublished
      : and(galleryPublished, eq(t.galleryItems.category, query.category));

  const { limit, offset } = pageSlice(query);

  const [rows, [total], facets] = await Promise.all([
    db
      .select()
      .from(t.galleryItems)
      .where(where)
      .orderBy(asc(t.galleryItems.sortOrder), asc(t.galleryItems.id))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(t.galleryItems).where(where),
    db
      .select({ code: t.galleryItems.category, value: count() })
      .from(t.galleryItems)
      .where(galleryPublished)
      .groupBy(t.galleryItems.category)
      .orderBy(desc(count())),
  ]);

  const media = await mediaContext(
    context,
    rows.map((row) => row.mediaId),
  );

  return {
    items: rows.map((row) => ({
      id: row.id,
      caption: text(row.caption, lang),
      category: row.category,
      spanCols: row.spanCols,
      spanRows: row.spanRows,
      media: mediaRef(row.mediaId, media),
    })),
    meta: pageMeta(query, total?.value ?? 0),
    facets: { categories: facets.map(toFacet) },
  };
}

const videoPublished = eq(t.videos.isPublished, true);

type VideoRow = typeof t.videos.$inferSelect;

function videoItem(row: VideoRow, media: MediaContext, lang: Lang) {
  const file = mediaRef(row.mediaId, media);
  return {
    id: row.id,
    slug: row.slug,
    title: text(row.title, lang),
    description: text(row.description, lang),
    kind: row.kind,
    url: file?.url ?? null,
    externalId: row.externalId,
    poster: mediaRef(row.posterMediaId, media),
    durationSec: row.durationSec,
    viewCount: row.viewCount,
    category: row.category,
    isFeatured: row.isFeatured,
  };
}

export async function listVideos(
  context: Context,
  query: { page: number; perPage: number; category?: string | undefined },
) {
  const { db, lang } = context;
  const where =
    query.category === undefined
      ? videoPublished
      : and(videoPublished, eq(t.videos.category, query.category));

  const { limit, offset } = pageSlice(query);

  const [rows, [total], facets] = await Promise.all([
    db
      .select()
      .from(t.videos)
      .where(where)
      .orderBy(asc(t.videos.sortOrder), asc(t.videos.id))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(t.videos).where(where),
    db
      .select({ code: t.videos.category, value: count() })
      .from(t.videos)
      .where(videoPublished)
      .groupBy(t.videos.category)
      .orderBy(desc(count())),
  ]);

  const media = await mediaContext(context, [
    ...rows.map((row) => row.mediaId),
    ...rows.map((row) => row.posterMediaId),
  ]);

  return {
    items: rows.map((row) => videoItem(row, media, lang)),
    meta: pageMeta(query, total?.value ?? 0),
    facets: {
      categories: facets
        .filter((facet): facet is { code: string; value: number } => facet.code !== null)
        .map(toFacet),
    },
  };
}

// ----------------------------------------------------------------------------------------
// Reviews, and the three numbers the design prints as literals
// ----------------------------------------------------------------------------------------

const reviewPublished = eq(t.reviews.status, 'published');

const REVIEW_ORDER = {
  newest: [desc(t.reviews.visitedOn), desc(t.reviews.id)],
  oldest: [asc(t.reviews.visitedOn), asc(t.reviews.id)],
  rating_desc: [desc(t.reviews.rating), desc(t.reviews.visitedOn)],
} as const;

/**
 * 4,8 · 214 · 92% — computed.
 *
 * All three are literals in the prototype, printed above nine review rows that contradict them.
 * Decision D-6. `recommendPercent` is the share rating four or better, which is the definition
 * the design's caption implies and nowhere states.
 */
export async function reviewSummary(db: Database) {
  const [row] = await db
    .select({
      total: count(),
      average: avg(t.reviews.rating),
      recommended: sql<number>`SUM(CASE WHEN ${t.reviews.rating} >= 4 THEN 1 ELSE 0 END)`,
    })
    .from(t.reviews)
    .where(reviewPublished);

  const total = row?.total ?? 0;
  const average = Number(row?.average ?? 0);
  const recommended = row?.recommended ?? 0;

  return {
    average: total === 0 ? 0 : Math.round(average * 10) / 10,
    total,
    recommendPercent: total === 0 ? 0 : Math.round((recommended / total) * 100),
  };
}

export async function listReviews(
  context: Context,
  query: {
    page: number;
    perPage: number;
    rating?: number | undefined;
    sort: keyof typeof REVIEW_ORDER;
  },
) {
  const { db, lang } = context;
  const where =
    query.rating === undefined
      ? reviewPublished
      : and(reviewPublished, eq(t.reviews.rating, query.rating));

  const { limit, offset } = pageSlice(query);

  const [rows, [total], summary] = await Promise.all([
    db
      .select()
      .from(t.reviews)
      .where(where)
      .orderBy(...REVIEW_ORDER[query.sort])
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(t.reviews).where(where),
    reviewSummary(db),
  ]);

  const media = await mediaContext(
    context,
    rows.map((row) => row.avatarMediaId),
  );

  return {
    items: rows.map((row) => ({
      id: row.id,
      authorName: row.authorName,
      authorCity: text(row.authorCity, lang),
      rating: row.rating,
      body: text(row.body, lang),
      visitedOn: row.visitedOn,
      tourTitle: text(row.tourTitle, lang),
      avatar: mediaRef(row.avatarMediaId, media),
    })),
    meta: pageMeta(query, total?.value ?? 0),
    summary,
  };
}

// ----------------------------------------------------------------------------------------
// Turkmenistan, FAQ, settings, slots
// ----------------------------------------------------------------------------------------

export async function listPlaces(context: Context) {
  const { db, lang } = context;
  const rows = await db
    .select()
    .from(t.placesToSee)
    .where(eq(t.placesToSee.isPublished, true))
    .orderBy(asc(t.placesToSee.sortOrder));

  const media = await mediaContext(
    context,
    rows.map((row) => row.coverMediaId),
  );

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: text(row.name, lang),
    region: text(row.region, lang),
    description: text(row.description, lang),
    cover: mediaRef(row.coverMediaId, media),
  }));
}

export async function listBlocks(
  db: Database,
  site: 'global' | 'umrah',
  blockCode: string,
  lang: Lang,
  options: { featuredOnly?: boolean } = {},
): Promise<ContentBlockItem[]> {
  const where =
    options.featuredOnly === true
      ? and(
          eq(t.contentBlocks.site, site),
          eq(t.contentBlocks.blockCode, blockCode),
          eq(t.contentBlocks.isFeatured, true),
        )
      : and(eq(t.contentBlocks.site, site), eq(t.contentBlocks.blockCode, blockCode));

  const rows = await db
    .select()
    .from(t.contentBlocks)
    .where(where)
    .orderBy(asc(t.contentBlocks.sortOrder));

  return rows.map((row) => blockItem(row, lang));
}

export async function listSlots(
  context: Context,
  site: 'choice' | 'global' | 'umrah',
  page: string,
): Promise<ContentSlot[]> {
  const rows = await context.db
    .select()
    .from(t.contentSlots)
    .where(and(eq(t.contentSlots.site, site), eq(t.contentSlots.page, page)))
    .orderBy(asc(t.contentSlots.sortOrder));

  const media = await mediaContext(
    context,
    rows.map((row) => row.mediaId),
  );
  return rows.map((row) => slotItem(row, media));
}

export async function listFaq(db: Database, site: 'global' | 'umrah', lang: Lang) {
  const rows = await db
    .select()
    .from(t.faqs)
    .where(and(eq(t.faqs.site, site), eq(t.faqs.isPublished, true)))
    .orderBy(asc(t.faqs.sortOrder));

  return rows.map((row) => ({
    id: row.id,
    question: text(row.question, lang),
    answer: text(row.answer, lang),
  }));
}

/**
 * Contacts, socials and the licence number.
 *
 * Every value is currently the prototype's own placeholder — the licence reads `TM-1428` and the
 * two sites give different email domains. `legal.unconfirmed` carries that fact to the client
 * rather than hiding it, which is question Q-12 made visible instead of forgotten.
 */
export async function getSettings(
  db: Database,
  site: 'global' | 'umrah',
  lang: Lang,
  langs: readonly string[],
  defaultLang: string,
): Promise<SiteSettings> {
  const rows = await db.select().from(t.settings).where(eq(t.settings.site, site));
  const byKey = new Map(rows.map((row) => [row.settingKey, row.value as Record<string, unknown>]));

  const contacts = byKey.get('contacts') ?? {};
  const socials = byKey.get('socials') ?? {};
  const legal = byKey.get('legal') ?? {};

  /** A settings value is free-form JSON, and some of its leaves are localised objects. */
  const value = (source: Record<string, unknown>, key: string): string => {
    const found = source[key];
    if (typeof found === 'string') return found;
    if (found !== null && typeof found === 'object') {
      return text(found, lang);
    }
    return '';
  };

  return {
    contacts: {
      phone: value(contacts, 'phone'),
      whatsapp: value(contacts, 'whatsapp'),
      email: value(contacts, 'email'),
      hours: value(contacts, 'hours'),
      address: value(contacts, 'address'),
    },
    socials: {
      instagram: value(socials, 'instagram'),
      telegram: value(socials, 'telegram'),
      whatsapp: value(socials, 'whatsapp'),
      youtube: value(socials, 'youtube'),
    },
    legal: { license: value(legal, 'license'), unconfirmed: legal['unconfirmed'] === true },
    langs: [...langs],
    defaultLang,
  };
}

// ----------------------------------------------------------------------------------------
// The homepage, in one request
// ----------------------------------------------------------------------------------------

export async function getHome(context: Context) {
  const { db, lang } = context;

  const [
    featured,
    hotels,
    articles,
    gallery,
    videos,
    reviews,
    facts,
    visaSteps,
    places,
    faq,
    slots,
    stats,
  ] = await Promise.all([
    listTours(context, { page: 1, perPage: 6, sort: 'popular' }),
    listHotels(context, { page: 1, perPage: 4, sort: 'popular' }),
    listArticles(context, { page: 1, perPage: 3 }),
    listGallery(context, { page: 1, perPage: 8 }),
    listVideos(context, { page: 1, perPage: 4 }),
    listReviews(context, { page: 1, perPage: 6, sort: 'newest' }),
    // Seven of the eight country facts, which is the only difference between the homepage list
    // and the one on `/turkmenistan` — one flag rather than a second table (D-17).
    listBlocks(db, 'global', 'country_facts', lang, { featuredOnly: true }),
    listBlocks(db, 'global', 'visa_steps', lang),
    listPlaces(context),
    listFaq(db, 'global', lang),
    listSlots(context, 'global', 'home'),
    homeStats(db),
  ]);

  return {
    featuredTours: featured.items,
    hotels: hotels.items,
    articles: articles.items,
    gallery: gallery.items,
    videos: videos.items,
    reviews: reviews.items,
    reviewSummary: reviews.summary,
    facts,
    visaSteps,
    places: places.slice(0, 6),
    faq,
    slots,
    stats,
  };
}

/** The counters the design writes as «32 маршрута» and «46 отелей». Question Q-5. */
async function homeStats(db: Database) {
  const [tours, hotels, reviews, places] = await Promise.all([
    db.select({ value: count() }).from(t.tours).where(published),
    db.select({ value: count() }).from(t.hotels).where(hotelPublished),
    db.select({ value: count() }).from(t.reviews).where(reviewPublished),
    db.select({ value: count() }).from(t.placesToSee).where(eq(t.placesToSee.isPublished, true)),
  ]);

  return {
    tours: tours[0]?.value ?? 0,
    hotels: hotels[0]?.value ?? 0,
    reviews: reviews[0]?.value ?? 0,
    places: places[0]?.value ?? 0,
  };
}

/**
 * A grouped count becomes a chip.
 *
 * The label is the code. Translating it is the client's job, from the same JSON files that hold
 * the rest of the interface copy (D-23) — putting a Russian label in the database here would
 * make a Turkish visitor's filter chips Russian.
 */
function toFacet(row: { code: string; value: number }): Facet {
  return { code: row.code, label: row.code, count: row.value };
}
