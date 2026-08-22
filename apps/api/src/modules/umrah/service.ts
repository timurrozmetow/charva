import { type Facet, type Lang, pageMeta, pageSlice, type UmrahTrip } from '@charva/contracts';
import { and, asc, count, desc, eq, gt, inArray, ne, sql, sum } from 'drizzle-orm';

import { type Database } from '../../db/client';
import * as t from '../../db/schema';
import { loadMedia, type MediaContext, mediaRef, text } from '../../lib/serialize';
import { deriveTripState } from '../../lib/trip-status';
import { notFound } from '../../plugins/error-handler';
import { listBlocks, listFaq, listHeroSlides, listSlots, type Context } from '../global/service';

/**
 * Charva Umrah.
 *
 * Two things are different here from the Global module, and both are structural.
 *
 * The departure is a *derived* thing rather than a flagged one (D-13), and it drives the
 * countdown, the seat bar, eight formatted dates and the state of the signup form from one row.
 * In the prototypes `2026-09-18T06:00:00Z` is hardcoded in three JavaScript files and typed
 * into eight more, so postponing a departure is a fourteen-file edit somebody gets wrong.
 *
 * And there is no price. `umrah_trips.price_minor` exists and is read nowhere in this file;
 * even if it were, the response schema has no field to put it in and the serialiser would drop
 * it on the wire. Decision D-12.
 */

type TripRow = typeof t.umrahTrips.$inferSelect;

/** Anything an editor has not finished is invisible to the public, whatever its dates say. */
const visibleStatuses = ['open', 'full', 'closed', 'departed', 'completed'] as const;

function parseSqlDate(value: string | null): Date | null {
  if (value === null) return null;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  return new Date(/[Zz]$/.test(normalized) ? normalized : `${normalized}Z`);
}

/**
 * A departure on the wire — and the exact place D-12 is enforced.
 *
 * `row.priceMinor` and `row.priceCurrency` are simply not read. The response schema has no
 * field for either, so even a future careless spread of the whole row would be trimmed by the
 * serialiser rather than reaching a browser.
 */
export function tripPublic(row: TripRow, lang: Lang, now: Date = new Date()): UmrahTrip {
  const departAt = parseSqlDate(row.departAt) ?? new Date(0);
  const returnAt = parseSqlDate(row.returnAt) ?? new Date(0);
  const signupClosesAt = parseSqlDate(row.signupClosesAt);

  const state = deriveTripState(
    { departAt, returnAt, signupClosesAt, seatsTotal: row.seatsTotal, seatsTaken: row.seatsTaken },
    now,
  );

  return {
    id: row.id,
    departAt: departAt.toISOString(),
    returnAt: returnAt.toISOString(),
    signupClosesAt: signupClosesAt?.toISOString() ?? null,
    durationDays: row.durationDays,
    seatsTotal: row.seatsTotal,
    seatsTaken: row.seatsTaken,
    seatsLeft: state.seatsLeft,
    seatsPercent: state.seatsPercent,
    status: state.status,
    signupOpen: state.signupOpen,
    hotelMekka: text(row.hotelMekka, lang),
    hotelMedina: text(row.hotelMedina, lang),
  };
}

/**
 * The current departure and the one after it.
 *
 * Derived rather than remembered. `is_current` is honoured when an editor has deliberately set
 * it — an owner may want to promote a later group — but nothing depends on somebody remembering
 * to move it, because a flag an administrator has to maintain is a flag that will be wrong in
 * the week they are away.
 */
export async function currentTrip(
  db: Database,
  lang: Lang,
  now: Date = new Date(),
): Promise<{ trip: UmrahTrip | null; next: UmrahTrip | null }> {
  const sqlNow = now.toISOString().slice(0, 19).replace('T', ' ');

  const [override] = await db
    .select()
    .from(t.umrahTrips)
    .where(and(eq(t.umrahTrips.isCurrent, true), inArray(t.umrahTrips.status, visibleStatuses)))
    .limit(1);

  const upcoming = await db
    .select()
    .from(t.umrahTrips)
    .where(and(inArray(t.umrahTrips.status, visibleStatuses), gt(t.umrahTrips.departAt, sqlNow)))
    .orderBy(asc(t.umrahTrips.departAt))
    .limit(2);

  const chosen = override ?? upcoming[0];
  if (chosen === undefined) return { trip: null, next: null };

  const following = upcoming.find((row) => row.id !== chosen.id);

  return {
    trip: tripPublic(chosen, lang, now),
    next: following === undefined ? null : tripPublic(following, lang, now),
  };
}

// ----------------------------------------------------------------------------------------
// Ziyarat
// ----------------------------------------------------------------------------------------

type ZiyaratRow = typeof t.ziyaratPlaces.$inferSelect;

const ziyaratPublished = eq(t.ziyaratPlaces.isPublished, true);

function ziyaratPlace(row: ZiyaratRow, media: MediaContext, lang: Lang) {
  return {
    id: row.id,
    slug: row.slug,
    name: text(row.name, lang),
    description: text(row.description, lang),
    city: row.city,
    durationLabel: text(row.durationLabel, lang),
    cover: mediaRef(row.coverMediaId, media),
  };
}

/**
 * The city chips, from the data.
 *
 * This is decision D-15 doing something concrete: the prototype hardcodes three chips and the
 * data has four cities, so every place in Jidda is unreachable by any filter. Counting from the
 * rows makes both directions impossible — no chip without places, no places without a chip.
 */
export async function listZiyarat(
  context: Context,
  query: { city?: 'mekge' | 'medine' | 'bedir' | 'jidda' | undefined },
) {
  const { db, lang } = context;
  const where =
    query.city === undefined
      ? ziyaratPublished
      : and(ziyaratPublished, eq(t.ziyaratPlaces.city, query.city));

  const [rows, facets] = await Promise.all([
    db
      .select()
      .from(t.ziyaratPlaces)
      .where(where)
      .orderBy(asc(t.ziyaratPlaces.sortOrder), asc(t.ziyaratPlaces.id)),
    db
      .select({ code: t.ziyaratPlaces.city, value: count() })
      .from(t.ziyaratPlaces)
      .where(ziyaratPublished)
      .groupBy(t.ziyaratPlaces.city)
      .orderBy(desc(count())),
  ]);

  const media = await mediaContextFor(
    context,
    rows.map((row) => row.coverMediaId),
  );

  return {
    items: rows.map((row) => ziyaratPlace(row, media, lang)),
    facets: {
      cities: facets.map((row): Facet => ({ code: row.code, label: row.code, count: row.value })),
    },
  };
}

export async function getZiyaratPlace(context: Context, slug: string) {
  const { db, lang } = context;

  const [place] = await db
    .select()
    .from(t.ziyaratPlaces)
    .where(and(ziyaratPublished, eq(t.ziyaratPlaces.slug, slug)))
    .limit(1);

  if (place === undefined) throw notFound(`Ziyarat place «${slug}»`);

  const nearby = await db
    .select()
    .from(t.ziyaratPlaces)
    .where(
      and(ziyaratPublished, eq(t.ziyaratPlaces.city, place.city), ne(t.ziyaratPlaces.id, place.id)),
    )
    .orderBy(asc(t.ziyaratPlaces.sortOrder))
    .limit(3);

  const media = await mediaContextFor(context, [
    place.coverMediaId,
    ...nearby.map((row) => row.coverMediaId),
  ]);

  return {
    place: ziyaratPlace(place, media, lang),
    nearby: nearby.map((row) => ziyaratPlace(row, media, lang)),
  };
}

// ----------------------------------------------------------------------------------------
// The programme
// ----------------------------------------------------------------------------------------

export async function listProgramDays(context: Context) {
  const { db, lang } = context;

  const rows = await db
    .select()
    .from(t.umrahProgramDays)
    .where(eq(t.umrahProgramDays.isPublished, true))
    .orderBy(asc(t.umrahProgramDays.dayNumber));

  const media = await mediaContextFor(
    context,
    rows.map((row) => row.mediaId),
  );

  return rows.map((row) => ({
    dayNumber: row.dayNumber,
    title: text(row.title, lang),
    description: text(row.description, lang),
    city: text(row.city, lang),
    media: mediaRef(row.mediaId, media),
  }));
}

// ----------------------------------------------------------------------------------------
// Groups that have already travelled
// ----------------------------------------------------------------------------------------

type GroupRow = typeof t.umrahGroups.$inferSelect;

const groupPublished = eq(t.umrahGroups.isPublished, true);

/**
 * Photo and video counts, as `COUNT(*)`.
 *
 * Never stored. The prototype keeps `videos: 4` beside three clips and `photos: 38` beside
 * eight captions; a derived count has nothing to drift from.
 */
async function mediaCounts(
  db: Database,
  groupIds: readonly number[],
): Promise<Map<number, { photos: number; videos: number }>> {
  const counts = new Map<number, { photos: number; videos: number }>();
  if (groupIds.length === 0) return counts;

  const rows = await db
    .select({
      groupId: t.umrahGroupMedia.groupId,
      kind: t.umrahGroupMedia.kind,
      value: count(),
    })
    .from(t.umrahGroupMedia)
    .where(inArray(t.umrahGroupMedia.groupId, [...groupIds]))
    .groupBy(t.umrahGroupMedia.groupId, t.umrahGroupMedia.kind);

  for (const row of rows) {
    const entry = counts.get(row.groupId) ?? { photos: 0, videos: 0 };
    if (row.kind === 'photo') entry.photos = row.value;
    else entry.videos = row.value;
    counts.set(row.groupId, entry);
  }
  return counts;
}

function groupCard(
  row: GroupRow,
  media: MediaContext,
  lang: Lang,
  counts: { photos: number; videos: number },
) {
  return {
    id: row.id,
    slug: row.slug,
    label: text(row.label, lang),
    shortLabel: text(row.shortLabel, lang),
    description: text(row.description, lang),
    departedOn: row.departedOn,
    pilgrimsCount: row.pilgrimsCount,
    cover: mediaRef(row.coverMediaId, media),
    photoCount: counts.photos,
    videoCount: counts.videos,
  };
}

export async function listGroups(context: Context, query: { page: number; perPage: number }) {
  const { db, lang } = context;
  const { limit, offset } = pageSlice(query);

  const [rows, [total], [totals]] = await Promise.all([
    db
      .select()
      .from(t.umrahGroups)
      .where(groupPublished)
      .orderBy(desc(t.umrahGroups.departedOn), asc(t.umrahGroups.sortOrder))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(t.umrahGroups).where(groupPublished),
    db
      .select({ pilgrims: sum(t.umrahGroups.pilgrimsCount) })
      .from(t.umrahGroups)
      .where(groupPublished),
  ]);

  const ids = rows.map((row) => row.id);
  const [media, counts, [mediaTotals]] = await Promise.all([
    mediaContextFor(
      context,
      rows.map((row) => row.coverMediaId),
    ),
    mediaCounts(db, ids),
    db
      .select({
        photos: sql<number>`SUM(CASE WHEN ${t.umrahGroupMedia.kind} = 'photo' THEN 1 ELSE 0 END)`,
        videos: sql<number>`SUM(CASE WHEN ${t.umrahGroupMedia.kind} = 'video' THEN 1 ELSE 0 END)`,
      })
      .from(t.umrahGroupMedia),
  ]);

  return {
    items: rows.map((row) =>
      groupCard(row, media, lang, counts.get(row.id) ?? { photos: 0, videos: 0 }),
    ),
    meta: pageMeta(query, total?.value ?? 0),
    stats: {
      groups: total?.value ?? 0,
      pilgrims: Number(totals?.pilgrims ?? 0),
      photos: mediaTotals?.photos ?? 0,
      videos: mediaTotals?.videos ?? 0,
    },
  };
}

export async function getGroup(context: Context, slug: string) {
  const { db, lang } = context;

  const [group] = await db
    .select()
    .from(t.umrahGroups)
    .where(and(groupPublished, eq(t.umrahGroups.slug, slug)))
    .limit(1);

  if (group === undefined) throw notFound(`Group «${slug}»`);

  const items = await db
    .select()
    .from(t.umrahGroupMedia)
    .where(eq(t.umrahGroupMedia.groupId, group.id))
    .orderBy(asc(t.umrahGroupMedia.sortOrder), asc(t.umrahGroupMedia.id));

  const [media, counts] = await Promise.all([
    mediaContextFor(context, [
      group.coverMediaId,
      ...items.map((item) => item.mediaId),
      ...items.map((item) => item.posterMediaId),
    ]),
    mediaCounts(db, [group.id]),
  ]);

  const serialise = (item: (typeof items)[number]) => ({
    id: item.id,
    kind: item.kind,
    caption: text(item.caption, lang),
    durationSec: item.durationSec,
    spanCols: item.spanCols,
    spanRows: item.spanRows,
    media: mediaRef(item.mediaId, media),
    poster: mediaRef(item.posterMediaId, media),
  });

  return {
    group: groupCard(group, media, lang, counts.get(group.id) ?? { photos: 0, videos: 0 }),
    photos: items.filter((item) => item.kind === 'photo').map(serialise),
    videos: items.filter((item) => item.kind === 'video').map(serialise),
  };
}

// ----------------------------------------------------------------------------------------
// Composites
// ----------------------------------------------------------------------------------------

export async function getPackage(context: Context) {
  const { db, lang } = context;

  const [current, items, conditions, included, signupOrder, slots] = await Promise.all([
    currentTrip(db, lang),
    listBlocks(db, 'umrah', 'package_items', lang),
    listBlocks(db, 'umrah', 'package_conditions', lang),
    listBlocks(db, 'umrah', 'package_included', lang),
    listBlocks(db, 'umrah', 'signup_order', lang),
    listSlots(context, 'umrah', 'package'),
  ]);

  return { trip: current.trip, items, conditions, included, signupOrder, slots };
}

export async function getProgram(context: Context) {
  const { db, lang } = context;

  const [current, days, routine, slots] = await Promise.all([
    currentTrip(db, lang),
    listProgramDays(context),
    listBlocks(db, 'umrah', 'daily_routine', lang),
    listSlots(context, 'umrah', 'program'),
  ]);

  return { trip: current.trip, days, routine, slots };
}

export async function getHome(context: Context) {
  const { db, lang } = context;

  const [slides, current, packageItems, ziyarat, program, groups, faq, slots, places] =
    await Promise.all([
      listHeroSlides(context, 'umrah'),
      currentTrip(db, lang),
      listBlocks(db, 'umrah', 'package_items', lang),
      listZiyarat(context, {}),
      listProgramDays(context),
      listGroups(context, { page: 1, perPage: 4 }),
      listFaq(db, 'umrah', lang),
      listSlots(context, 'umrah', 'home'),
      db.select({ value: count() }).from(t.ziyaratPlaces).where(ziyaratPublished),
    ]);

  return {
    slides,
    trip: current.trip,
    next: current.next,
    packageItems,
    ziyarat: ziyarat.items.slice(0, 4),
    program,
    groups: groups.items,
    faq,
    slots,
    stats: {
      groups: groups.stats.groups,
      pilgrims: groups.stats.pilgrims,
      places: places[0]?.value ?? 0,
      programDays: program.length,
    },
  };
}

async function mediaContextFor(
  context: Context,
  ids: readonly (number | null | undefined)[],
): Promise<MediaContext> {
  return { baseUrl: context.baseUrl, lang: context.lang, byId: await loadMedia(context.db, ids) };
}
