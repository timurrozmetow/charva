import { z } from 'zod';

import {
  contentBlockSchema,
  facetSchema,
  faqSchema,
  moneySchema,
  pageMetaSchema,
  paginated,
  siteSettingsSchema,
} from './common';
import { contentSlotSchema, mediaRefSchema } from './media';

/**
 * Charva Travel Global — the catalogue.
 *
 * Every localised column has already been resolved into one string by `pickLocale` before it
 * reaches these shapes. The alternative — shipping `{ru, en, tr}` and choosing in the browser —
 * sends three copies of every sentence to a visitor on mobile data and moves the fallback rule
 * into three SPAs instead of keeping it in one tested function.
 */

// ----------------------------------------------------------------------------------------
// Tours
// ----------------------------------------------------------------------------------------

export const tourCardSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  /** The pill over the cover — «Хит», «Новинка». Empty when the row has none. */
  tag: z.string(),
  /** `classic`, `nature`, … A code; the chip label comes from the facet. */
  category: z.string(),
  days: z.number().int(),
  cities: z.number().int(),
  hotelStars: z.number().int().nullable(),
  priceFrom: moneySchema,
  cover: mediaRefSchema.nullable(),
  isFeatured: z.boolean(),
});

export type TourCard = z.infer<typeof tourCardSchema>;

export const tourDaySchema = z.object({
  dayNumber: z.number().int(),
  title: z.string(),
  description: z.string(),
  city: z.string(),
  media: mediaRefSchema.nullable(),
});

export const tourDetailSchema = tourCardSchema.extend({
  body: z.string(),
  /** The day-by-day programme. Named apart from `days`, which is the trip's length. */
  itinerary: z.array(tourDaySchema),
  gallery: z.array(z.object({ caption: z.string(), media: mediaRefSchema })),
  /** Same category, published, excluding this one. Three at most. */
  related: z.array(tourCardSchema),
});

export const toursQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(16),
  category: z.string().max(40).optional(),
  /** `popular` follows the editor's `sort_order`; the rest are what the design's chips offer. */
  sort: z.enum(['popular', 'price_asc', 'price_desc', 'days_asc', 'days_desc']).default('popular'),
});

export const toursResponse = z.object({
  items: z.array(tourCardSchema),
  meta: pageMetaSchema,
  facets: z.object({ categories: z.array(facetSchema) }),
});

// ----------------------------------------------------------------------------------------
// Hotels
// ----------------------------------------------------------------------------------------

export const amenitySchema = z.object({
  code: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
});

export const hotelCardSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  summary: z.string(),
  city: z.string(),
  /** 3, 4 or 5 — and null for a camp or a boutique, which is the point of the pair. */
  stars: z.number().int().nullable(),
  category: z.enum(['hotel', 'boutique', 'camp']),
  /**
   * `5star`, `camp`, `boutique` — derived, never stored.
   *
   * The prototype shows a yurt camp as «3★» on its card and «Кемп» in the filter, two facts
   * about one row that cannot both be true. Deriving the key makes the contradiction
   * unrepresentable.
   */
  filterKey: z.string(),
  priceFrom: moneySchema,
  cover: mediaRefSchema.nullable(),
  amenities: z.array(amenitySchema),
});

export type HotelCard = z.infer<typeof hotelCardSchema>;

export const hotelDetailSchema = hotelCardSchema.extend({
  body: z.string(),
});

export const hotelsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(16),
  /** One of the derived keys above, so a chip cannot ask for a combination that has no rows. */
  filter: z.string().max(40).optional(),
  sort: z.enum(['popular', 'price_asc', 'price_desc', 'stars_desc']).default('popular'),
});

export const hotelsResponse = z.object({
  items: z.array(hotelCardSchema),
  meta: pageMetaSchema,
  facets: z.object({ categories: z.array(facetSchema) }),
});

// ----------------------------------------------------------------------------------------
// Articles
// ----------------------------------------------------------------------------------------

export const articleCardSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  tag: z.string(),
  /** Rendered as «6 мин чтения». A number, so the unit can be translated. */
  readMinutes: z.number().int().nullable(),
  publishedAt: z.string().nullable(),
  cover: mediaRefSchema.nullable(),
  isFeatured: z.boolean(),
});

export const articleDetailSchema = articleCardSchema.extend({
  body: z.string(),
  related: z.array(articleCardSchema),
});

export const articlesQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(12),
});

export const articlesResponse = paginated(articleCardSchema);

// ----------------------------------------------------------------------------------------
// Gallery, video
// ----------------------------------------------------------------------------------------

export const galleryItemSchema = z.object({
  id: z.number().int(),
  caption: z.string(),
  category: z.string(),
  /** The editor's opinion about which photograph deserves the room. The packer may narrow it. */
  spanCols: z.number().int(),
  spanRows: z.number().int(),
  media: mediaRefSchema.nullable(),
});

export const galleryQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(16),
  category: z.string().max(40).optional(),
});

export const galleryResponse = z.object({
  items: z.array(galleryItemSchema),
  meta: pageMetaSchema,
  facets: z.object({ categories: z.array(facetSchema) }),
});

export const videoSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  kind: z.enum(['file', 'youtube', 'vimeo']),
  /** Set for `file`: the transcoded copy, served with byte ranges so it can be scrubbed. */
  url: z.string().nullable(),
  /** Set for `youtube` and `vimeo`. */
  externalId: z.string().nullable(),
  poster: mediaRefSchema.nullable(),
  /** Seconds, never `14:20`: a rendering in one locale cannot be sorted or re-formatted. */
  durationSec: z.number().int().nullable(),
  viewCount: z.number().int(),
  category: z.string().nullable(),
  isFeatured: z.boolean(),
});

export const videosQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(12),
  category: z.string().max(40).optional(),
});

export const videosResponse = z.object({
  items: z.array(videoSchema),
  meta: pageMetaSchema,
  facets: z.object({ categories: z.array(facetSchema) }),
});

// ----------------------------------------------------------------------------------------
// Reviews
// ----------------------------------------------------------------------------------------

export const reviewSchema = z.object({
  id: z.number().int(),
  authorName: z.string(),
  authorCity: z.string(),
  rating: z.number().int(),
  body: z.string(),
  /** A real date, so «Сначала новые» sorts. The prototype stores «Май 2026» as a string. */
  visitedOn: z.string().nullable(),
  tourTitle: z.string(),
  avatar: mediaRefSchema.nullable(),
});

/**
 * The three numbers the design prints as literals — 4,8 · 214 · 92%.
 *
 * Computed from published rows, so they cannot contradict the reviews shown beneath them, which
 * today they do: the prototype claims 214 beside nine. Decision D-6.
 */
export const reviewSummarySchema = z.object({
  /** Mean rating, rounded to one decimal. Zero when there are no reviews at all. */
  average: z.number(),
  total: z.number().int(),
  /** Share rating four or better, as a whole percent. */
  recommendPercent: z.number().int(),
});

export const reviewsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(12),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  sort: z.enum(['newest', 'oldest', 'rating_desc']).default('newest'),
});

export const reviewsResponse = z.object({
  items: z.array(reviewSchema),
  meta: pageMetaSchema,
  summary: reviewSummarySchema,
});

// ----------------------------------------------------------------------------------------
// Turkmenistan, FAQ, settings
// ----------------------------------------------------------------------------------------

export const placeSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  region: z.string(),
  description: z.string(),
  cover: mediaRefSchema.nullable(),
});

export const countryResponse = z.object({
  places: z.array(placeSchema),
  /** Eight on this page; the homepage repeats seven of them. One flag, not a second table. */
  facts: z.array(contentBlockSchema),
  visaSteps: z.array(contentBlockSchema),
  slots: z.array(contentSlotSchema),
});

export const faqResponse = z.object({ items: z.array(faqSchema) });

export const globalSettingsResponse = siteSettingsSchema;

// ----------------------------------------------------------------------------------------
// The homepage, in one request
// ----------------------------------------------------------------------------------------

/**
 * Everything the homepage draws, assembled on the server.
 *
 * Nine separate requests on a connection that may be poor is nine chances to arrive
 * half-rendered, and nine round trips before the largest element on the page can start loading.
 * The data is the same; it is cached as one piece with one ETag.
 */
export const globalHomeResponse = z.object({
  featuredTours: z.array(tourCardSchema),
  hotels: z.array(hotelCardSchema),
  articles: z.array(articleCardSchema),
  gallery: z.array(galleryItemSchema),
  videos: z.array(videoSchema),
  reviews: z.array(reviewSchema),
  reviewSummary: reviewSummarySchema,
  facts: z.array(contentBlockSchema),
  visaSteps: z.array(contentBlockSchema),
  places: z.array(placeSchema),
  faq: z.array(faqSchema),
  slots: z.array(contentSlotSchema),
  /**
   * The counters the design prints as literals — «32 маршрута», «46 отелей», «1 400+ гостей».
   *
   * `COUNT(*)` over published rows, which today means nine and nine. Question Q-5 asks the
   * owner whether to fill the catalogue, accept the real numbers, or record a marketing figure
   * as an explicit override in `settings` — but never to keep two numbers for one fact.
   */
  stats: z.object({
    tours: z.number().int(),
    hotels: z.number().int(),
    reviews: z.number().int(),
    places: z.number().int(),
  }),
});
