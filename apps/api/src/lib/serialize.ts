import {
  type ContentBlockItem,
  type ContentSlot,
  type Lang,
  type MediaRef,
  pickLocale,
  uploadUrl,
} from '@charva/contracts';
import { inArray } from 'drizzle-orm';

import { type Database } from '../db/client';
import * as t from '../db/schema';

/**
 * Turning rows into responses.
 *
 * Two things happen here and both are decisions rather than plumbing. Translated columns are
 * resolved into a single string on the server, so a visitor on mobile data is not sent three
 * copies of every sentence and the fallback rule stays in one tested function instead of being
 * re-implemented in three SPAs. And `media.storage_key` becomes a URL, which is the whole
 * reason the column holds a key: moving to object storage changes this file and nothing else.
 */

type MediaRow = typeof t.media.$inferSelect;

/** Every localised column goes through here, so `pickLocale` has exactly one call site shape. */
export function text(value: Partial<Record<Lang, string>> | null | undefined, lang: Lang): string {
  return pickLocale(value, lang);
}

/**
 * How focal points are stored against how they are used.
 *
 * The column is 0–1000 so it stays an integer; `Img` wants 0–1. Doing the division here means
 * no component ever has to know which of the two it is holding.
 */
function focal(value: number | null): number | null {
  return value === null ? null : value / 1000;
}

export interface MediaContext {
  /** Empty in development, meaning "same origin as the API". */
  baseUrl: string;
  lang: Lang;
  byId: Map<number, MediaRow>;
}

export function mediaUrl(storageKey: string, baseUrl: string): string {
  // The prefix is part of the path, not of the origin: `/uploads` is registered inside the
  // same versioned plugin as every other route, so a URL built without it is a 404.
  return uploadUrl(storageKey, baseUrl);
}

/**
 * A media reference, or null.
 *
 * Null is the ordinary case today rather than an error: the handoff contains no photographs at
 * all, so every `cover_media_id` in the seeds is null and every page renders through
 * `ImageSlot` instead. Decision D-21, question Q-1.
 */
export function mediaRef(id: number | null | undefined, context: MediaContext): MediaRef | null {
  if (id == null) return null;
  const row = context.byId.get(id);
  if (row === undefined) return null;

  return {
    url: mediaUrl(row.storageKey, context.baseUrl),
    width: row.width,
    height: row.height,
    alt: text(row.alt, context.lang),
    lqip: row.lqip,
    focalX: focal(row.focalX),
    focalY: focal(row.focalY),
  };
}

/**
 * Loads every media row a response will need, in one query.
 *
 * Collected across the whole response rather than per row, because the homepage alone
 * references covers from six different tables and doing it per entity is where an N+1 comes
 * from — thirty round trips for a page that should make one.
 */
export async function loadMedia(
  db: Database,
  ids: readonly (number | null | undefined)[],
): Promise<Map<number, MediaRow>> {
  const wanted = [...new Set(ids.filter((id): id is number => typeof id === 'number'))];
  if (wanted.length === 0) return new Map();

  const rows = await db.select().from(t.media).where(inArray(t.media.id, wanted));
  return new Map(rows.map((row) => [row.id, row]));
}

export function blockItem(row: typeof t.contentBlocks.$inferSelect, lang: Lang): ContentBlockItem {
  return {
    id: row.id,
    key: text(row.keyText, lang),
    value: text(row.valueText, lang),
    note: text(row.note, lang),
    icon: row.icon,
  };
}

export function slotItem(
  row: typeof t.contentSlots.$inferSelect,
  context: MediaContext,
): ContentSlot {
  return {
    slotKey: row.slotKey,
    brief: row.brief,
    recommendedWidth: row.recommendedWidth,
    recommendedHeight: row.recommendedHeight,
    media: mediaRef(row.mediaId, context),
  };
}

/**
 * The hotel filter key, derived rather than stored.
 *
 * `category === 'hotel' ? '<n>star' : category`. The prototype shows a yurt camp as «3★» on its
 * card and «Кемп» in the filter — two facts about one row that cannot both be true. Deriving
 * the key means there is only ever one.
 */
export function hotelFilterKey(category: string, stars: number | null): string {
  return category === 'hotel' && stars !== null ? `${String(stars)}star` : category;
}

/**
 * A moment, as ISO 8601 in UTC.
 *
 * Drizzle returns `timestamp` columns as `Date` and `datetime({ mode: 'string' })` as the raw
 * `2026-09-18 06:00:00` MySQL writes — which is UTC, because the pool is opened with
 * `timezone: 'Z'` and the departure times are stored that way. The space has to become a `T`
 * and the `Z` has to be added explicitly: without it every environment parses the string in its
 * own local zone, and a departure from Ashgabat shifts by five hours on a server in Frankfurt.
 */
export function isoOrNull(value: string | Date | null): string | null {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();

  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  return new Date(
    /[Zz]$|[+-]\d{2}:?\d{2}$/.test(normalized) ? normalized : `${normalized}Z`,
  ).toISOString();
}
