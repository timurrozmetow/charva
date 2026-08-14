import { type Capability, type Site } from '@charva/contracts';
import { type MySqlTable } from 'drizzle-orm/mysql-core';

import * as t from '../../../db/schema';

import { describeTable, type FieldSpec } from './fields';

/**
 * Every table the admin edits through the shared frame, and the handful of facts the frame
 * cannot read off the table itself.
 *
 * This registry is the phase-7 answer to «fifteen screens of near-identical CRUD». A resource
 * costs a dozen lines here and gets a list, a form, ordering, validation, an audit trail and a
 * place in `/docs` — all from one implementation. What it does not cost is a per-entity route
 * file, which is where the copies would drift apart.
 *
 * Four things are declared rather than inferred, because nothing in the schema says them:
 *
 *   — which site a row belongs to, so an Umrah editor cannot touch a tour;
 *   — which JSON columns hold translated text, since a bag of anything is also `MySqlJson`;
 *   — which columns a search box should look at;
 *   — which foreign keys a list may be filtered by, which is what makes a child table (the days
 *     of a tour, the photographs of a group) usable at all.
 *
 * Deliberately absent: `media`, `content_slots`, `leads`, `umrah_signups` and `admin_users`.
 * Each has an interaction the frame would have to be bent around — an upload, a checklist, a
 * decryption behind an audit row, a password — and bending it for five exceptions is how a
 * generic frame stops being one.
 *
 * Absent for a different reason: `hotel_amenities`. It has no surrogate key at all — the
 * primary key is the pair of foreign keys — so the frame cannot address a row of it, and a
 * checkbox list is what an editor wants there anyway. It gets one route of its own instead.
 */

export interface AdminResource {
  /** Path segment and audit entity name. The SQL table name, so a log row names a real table. */
  name: string;
  table: MySqlTable;
  /** `null` for rows both sites share. */
  site: Site | null;
  capability: Capability;
  fields: FieldSpec[];
  /** Columns a `?q=` matches, translated ones included via the site's default language. */
  search: readonly string[];
  /** Columns that may narrow a list: `?tourId=3`, `?site=umrah`, `?blockCode=visa_steps`. */
  filters: readonly string[];
  /** Default ordering, most useful first for a human reading the list. */
  orderBy: readonly string[];
  /** True when the table carries `sortOrder` and the list can be dragged into order. */
  orderable: boolean;
}

interface Definition {
  table: MySqlTable;
  site: Site | null;
  capability?: Capability;
  localized?: readonly string[];
  money?: readonly string[];
  search?: readonly string[];
  filters?: readonly string[];
  orderBy?: readonly string[];
  orderable?: boolean;
}

function define(name: string, definition: Definition): AdminResource {
  const fields = describeTable(definition.table, {
    ...(definition.localized === undefined ? {} : { localized: definition.localized }),
    ...(definition.money === undefined ? {} : { money: definition.money }),
  });

  const orderable = definition.orderable ?? fields.some((field) => field.name === 'sortOrder');

  /*
   * The frame addresses a row by `id`, so a table without one cannot be served by it.
   *
   * `hotel_amenities` is that table — a composite key over two foreign keys — and it is not in
   * the registry for exactly this reason. Thrown at module load rather than checked at the
   * first request: a resource that cannot work should fail the boot, not the editor.
   */
  if (!fields.some((field) => field.name === 'id')) {
    throw new Error(`${name} has no surrogate id, so the CRUD frame cannot address its rows`);
  }

  return {
    name,
    table: definition.table,
    site: definition.site,
    capability: definition.capability ?? 'content.write',
    fields,
    search: definition.search ?? [],
    filters: definition.filters ?? [],
    orderBy: definition.orderBy ?? (orderable ? ['sortOrder', 'id'] : ['id']),
    orderable,
  };
}

const RESOURCES: AdminResource[] = [
  // ---- Global ---------------------------------------------------------------------------
  define('tours', {
    table: t.tours,
    site: 'global',
    localized: ['title', 'summary', 'body', 'tag'],
    money: ['priceFromMinor'],
    search: ['slug', 'title', 'category'],
    filters: ['category', 'isPublished', 'isFeatured'],
  }),
  define('tour_days', {
    table: t.tourDays,
    site: 'global',
    localized: ['title', 'description', 'city'],
    filters: ['tourId'],
    orderBy: ['tourId', 'dayNumber'],
    orderable: false,
  }),
  define('tour_media', {
    table: t.tourMedia,
    site: 'global',
    localized: ['caption'],
    filters: ['tourId'],
  }),
  define('hotels', {
    table: t.hotels,
    site: 'global',
    localized: ['name', 'summary', 'body', 'city'],
    money: ['priceFromMinor'],
    search: ['slug', 'name'],
    filters: ['category', 'stars', 'isPublished'],
  }),
  define('amenities', {
    table: t.amenities,
    site: 'global',
    localized: ['name'],
    search: ['code'],
  }),
  define('articles', {
    table: t.articles,
    site: 'global',
    localized: ['title', 'summary', 'body', 'tag'],
    search: ['slug', 'title'],
    filters: ['isPublished', 'isFeatured'],
  }),
  define('gallery_items', {
    table: t.galleryItems,
    site: 'global',
    localized: ['caption'],
    search: ['category'],
    filters: ['category', 'isPublished'],
  }),
  define('videos', {
    table: t.videos,
    site: 'global',
    localized: ['title', 'description'],
    search: ['slug', 'title'],
    filters: ['category', 'kind', 'isPublished'],
  }),
  define('reviews', {
    table: t.reviews,
    site: 'global',
    localized: ['authorCity', 'body', 'tourTitle'],
    search: ['authorName'],
    filters: ['rating', 'isPublished', 'tourId'],
  }),
  define('faqs', {
    table: t.faqs,
    site: 'global',
    localized: ['question', 'answer'],
    filters: ['site', 'isPublished'],
  }),
  define('places_to_see', {
    table: t.placesToSee,
    site: 'global',
    localized: ['name', 'region', 'description'],
    search: ['slug', 'name'],
    filters: ['isPublished'],
  }),

  // ---- The builder ----------------------------------------------------------------------
  //
  // Rates are settings, not content: an editor who may write an article should not be able to
  // change what every open quote in the world adds up to.
  define('builder_steps', {
    table: t.builderSteps,
    site: 'global',
    capability: 'settings.write',
    localized: ['title', 'hint', 'railLabel'],
    search: ['code'],
  }),
  define('builder_options', {
    table: t.builderOptions,
    site: 'global',
    capability: 'settings.write',
    localized: ['name', 'note'],
    money: ['priceModifierMinor'],
    search: ['code'],
    filters: ['stepId'],
  }),
  define('pricing_rules', {
    table: t.pricingRules,
    site: 'global',
    capability: 'settings.write',
    money: ['valueMinor'],
    search: ['keyName'],
    orderable: false,
  }),

  // ---- Umrah ----------------------------------------------------------------------------
  define('umrah_trips', {
    table: t.umrahTrips,
    site: 'umrah',
    localized: ['hotelMekka', 'hotelMedina'],
    // The one place a price for the pilgrimage may be written. It is never on the public wire,
    // and that is a property of the response schemas out there, not of a convention in here.
    money: ['priceMinor'],
    filters: ['status', 'isCurrent'],
    orderBy: ['departAt'],
    orderable: false,
  }),
  define('umrah_program_days', {
    table: t.umrahProgramDays,
    site: 'umrah',
    localized: ['title', 'description', 'city'],
    orderBy: ['dayNumber'],
    orderable: false,
  }),
  define('ziyarat_places', {
    table: t.ziyaratPlaces,
    site: 'umrah',
    localized: ['name', 'description', 'durationLabel'],
    search: ['slug', 'name'],
    filters: ['city', 'isPublished'],
  }),
  define('umrah_groups', {
    table: t.umrahGroups,
    site: 'umrah',
    localized: ['label', 'shortLabel', 'description'],
    search: ['slug'],
    filters: ['tripId', 'isPublished'],
    orderBy: ['departedOn'],
    orderable: false,
  }),
  define('umrah_group_media', {
    table: t.umrahGroupMedia,
    site: 'umrah',
    localized: ['caption'],
    filters: ['groupId', 'kind'],
  }),

  // ---- Both sites -----------------------------------------------------------------------
  define('content_blocks', {
    table: t.contentBlocks,
    site: null,
    localized: ['keyText', 'valueText', 'note'],
    search: ['blockCode'],
    filters: ['site', 'blockCode', 'isFeatured'],
  }),
  define('settings', {
    table: t.settings,
    site: null,
    capability: 'settings.write',
    search: ['settingKey'],
    filters: ['site'],
    orderBy: ['site', 'settingKey'],
    orderable: false,
  }),
];

export const ADMIN_RESOURCES: readonly AdminResource[] = RESOURCES;

export const RESOURCES_BY_NAME: ReadonlyMap<string, AdminResource> = new Map(
  RESOURCES.map((resource) => [resource.name, resource]),
);
