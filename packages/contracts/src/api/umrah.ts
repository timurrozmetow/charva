import { z } from 'zod';

import {
  contentBlockSchema,
  facetSchema,
  faqSchema,
  pageMetaSchema,
  siteSettingsSchema,
} from './common';
import { contentSlotSchema, heroSlideSchema, mediaRefSchema } from './media';

/**
 * Charva Umrah.
 *
 * One package, and no prices anywhere on the public site. `umrah_trips.price_minor` exists for
 * the admin, and there is no field for it below — that absence is decision D-12 and it is a
 * mechanism rather than a convention, because `fastify-type-provider-zod` uses the response
 * schema as the serialiser. A careless `select *` in a service is trimmed on the wire. A
 * convention gets forgotten; a serialiser does not.
 */

/**
 * The six states of a departure, five of which the prototype has no idea about.
 *
 * Derived at read time from the clock and the seat count rather than trusted from the column —
 * decision D-13. The stored status is what the admin lists sort by; this is what the site
 * shows, and it stays correct even if the cron that writes the column has been dead for a week.
 */
export const UMRAH_TRIP_STATUSES = ['open', 'full', 'closed', 'departed', 'completed'] as const;

export type UmrahTripStatus = (typeof UMRAH_TRIP_STATUSES)[number];

export const umrahTripSchema = z.object({
  id: z.number().int(),
  /** UTC, ISO 8601. Every displayed date and the whole countdown are computed from this one
   * value — in the prototypes it is hardcoded in three files and typed into eight more. */
  departAt: z.string(),
  returnAt: z.string(),
  signupClosesAt: z.string().nullable(),
  durationDays: z.number().int(),
  seatsTotal: z.number().int(),
  seatsTaken: z.number().int(),
  /** Sent computed so no client repeats the subtraction and none of them clamps differently. */
  seatsLeft: z.number().int(),
  /**
   * Filled share, to one decimal.
   *
   * 33 of 45 is 73.3, and the prototype draws a bar of literally `width:73%` beside a caption
   * that says 33 / 45. Two numbers for one fact.
   */
  seatsPercent: z.number(),
  status: z.enum(UMRAH_TRIP_STATUSES),
  /** Whether the form accepts submissions. False once the list closes or the group leaves. */
  signupOpen: z.boolean(),
  hotelMekka: z.string(),
  hotelMedina: z.string(),
});

export type UmrahTrip = z.infer<typeof umrahTripSchema>;

/**
 * The current departure, or nothing.
 *
 * `null` is a real answer and one of the two states nobody drew — question Q-4. It happens the
 * first time a group leaves and the next has not been announced, which is a fortnight after
 * launch, not an edge case.
 */
export const umrahCurrentTripResponse = z.object({
  trip: umrahTripSchema.nullable(),
  /** The one after this, when it exists — what the site promotes once a group is in the air. */
  next: umrahTripSchema.nullable(),
});

// ----------------------------------------------------------------------------------------
// The package
// ----------------------------------------------------------------------------------------

export const umrahPackageResponse = z.object({
  trip: umrahTripSchema.nullable(),
  /** «Näme girýär» — what the package contains. */
  items: z.array(contentBlockSchema),
  /** The conditions table. */
  conditions: z.array(contentBlockSchema),
  /** «Baha girýär» — included in the price. Which is never itself shown. */
  included: z.array(contentBlockSchema),
  /** «Ýazylyş tertibi» — the order of signing up. */
  signupOrder: z.array(contentBlockSchema),
  slots: z.array(contentSlotSchema),
});

// ----------------------------------------------------------------------------------------
// Ziyarat
// ----------------------------------------------------------------------------------------

export const ziyaratPlaceSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  city: z.enum(['mekge', 'medine', 'bedir', 'jidda']),
  /** «2 sagat», «Ýarym gün» — a phrase, not a number, and translated. */
  durationLabel: z.string(),
  cover: mediaRefSchema.nullable(),
});

export const ziyaratQuery = z.object({
  city: z.enum(['mekge', 'medine', 'bedir', 'jidda']).optional(),
});

/**
 * The city chips come from the data.
 *
 * The prototype hardcodes three and forgets Jidda, so a quarter of the places cannot be reached
 * by any filter. Building the list with `SELECT DISTINCT` makes that impossible — D-15.
 */
export const ziyaratResponse = z.object({
  items: z.array(ziyaratPlaceSchema),
  facets: z.object({ cities: z.array(facetSchema) }),
});

export const ziyaratDetailResponse = z.object({
  place: ziyaratPlaceSchema,
  nearby: z.array(ziyaratPlaceSchema),
});

// ----------------------------------------------------------------------------------------
// The programme
// ----------------------------------------------------------------------------------------

export const umrahProgramDaySchema = z.object({
  dayNumber: z.number().int(),
  title: z.string(),
  description: z.string(),
  city: z.string(),
  media: mediaRefSchema.nullable(),
});

export const umrahProgramResponse = z.object({
  trip: umrahTripSchema.nullable(),
  days: z.array(umrahProgramDaySchema),
  /** The daily routine — one of the seven lists D-17 folded into `content_blocks`. */
  routine: z.array(contentBlockSchema),
  slots: z.array(contentSlotSchema),
});

// ----------------------------------------------------------------------------------------
// Groups that have already travelled
// ----------------------------------------------------------------------------------------

export const umrahGroupCardSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  label: z.string(),
  shortLabel: z.string(),
  description: z.string(),
  departedOn: z.string().nullable(),
  pilgrimsCount: z.number().int().nullable(),
  cover: mediaRefSchema.nullable(),
  /**
   * `COUNT(*)`, never a stored column.
   *
   * The prototype keeps `videos: 4` beside three clips and `photos: 38` beside eight captions.
   * A derived count cannot drift, because there is nothing for it to drift from.
   */
  photoCount: z.number().int(),
  videoCount: z.number().int(),
});

export const umrahGroupMediaSchema = z.object({
  id: z.number().int(),
  kind: z.enum(['photo', 'video']),
  caption: z.string(),
  durationSec: z.number().int().nullable(),
  spanCols: z.number().int(),
  spanRows: z.number().int(),
  media: mediaRefSchema.nullable(),
  poster: mediaRefSchema.nullable(),
});

export const umrahGroupsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(12),
});

export const umrahGroupsResponse = z.object({
  items: z.array(umrahGroupCardSchema),
  meta: pageMetaSchema,
  /** Everything the archive table needs: totals across every published group. */
  stats: z.object({
    groups: z.number().int(),
    pilgrims: z.number().int(),
    photos: z.number().int(),
    videos: z.number().int(),
  }),
});

export const umrahGroupDetailResponse = z.object({
  group: umrahGroupCardSchema,
  photos: z.array(umrahGroupMediaSchema),
  videos: z.array(umrahGroupMediaSchema),
});

// ----------------------------------------------------------------------------------------
// Settings and the homepage
// ----------------------------------------------------------------------------------------

export const umrahSettingsResponse = siteSettingsSchema;

export const umrahHomeResponse = z.object({
  /**
   * The slider, from its own table.
   *
   * Three slides, and the third is «Topar» — a photograph of a group in ihram. It was never a
   * ziyarat place, so while the hero read from that table it could not be shown at all; the
   * third place in the list stood in for it.
   */
  slides: z.array(heroSlideSchema),
  trip: umrahTripSchema.nullable(),
  next: umrahTripSchema.nullable(),
  /** The package composition, as the card on the homepage shows it. */
  packageItems: z.array(contentBlockSchema),
  ziyarat: z.array(ziyaratPlaceSchema),
  program: z.array(umrahProgramDaySchema),
  groups: z.array(umrahGroupCardSchema),
  faq: z.array(faqSchema),
  slots: z.array(contentSlotSchema),
  /** Counted, like everything else the design writes as a literal — «68 групп», «2 840». */
  stats: z.object({
    groups: z.number().int(),
    pilgrims: z.number().int(),
    places: z.number().int(),
    programDays: z.number().int(),
  }),
});

export type ZiyaratPlace = z.infer<typeof ziyaratPlaceSchema>;
export type ZiyaratResponse = z.infer<typeof ziyaratResponse>;
export type ZiyaratDetailResponse = z.infer<typeof ziyaratDetailResponse>;
export type UmrahProgramDay = z.infer<typeof umrahProgramDaySchema>;
export type UmrahProgramResponse = z.infer<typeof umrahProgramResponse>;
export type UmrahGroupCard = z.infer<typeof umrahGroupCardSchema>;
export type UmrahGroupMedia = z.infer<typeof umrahGroupMediaSchema>;
export type UmrahGroupsResponse = z.infer<typeof umrahGroupsResponse>;
export type UmrahGroupDetailResponse = z.infer<typeof umrahGroupDetailResponse>;
export type UmrahPackageResponse = z.infer<typeof umrahPackageResponse>;
export type UmrahCurrentTripResponse = z.infer<typeof umrahCurrentTripResponse>;
export type UmrahHomeResponse = z.infer<typeof umrahHomeResponse>;
export type UmrahSettingsResponse = z.infer<typeof umrahSettingsResponse>;
