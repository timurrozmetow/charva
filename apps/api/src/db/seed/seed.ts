import { DEFAULT_PRICING_RULES } from '@charva/contracts';
import { sql } from 'drizzle-orm';

import { type Database } from '../client';
import * as t from '../schema';

import { loadContent, rows, SCREEN_PAGES, type SlottedRow } from './content';
import {
  codeFromLabel,
  GALLERY_CATEGORIES,
  HOTEL_CATEGORIES,
  parseCount,
  parseDmy,
  parseDuration,
  parseMoney,
  parseMonthYear,
  parseSpan,
  parseStars,
  parseViews,
  slugify,
  TOUR_CATEGORIES,
  ZIYARAT_CITIES,
} from './parse';

/**
 * The catalogue, from the prototypes.
 *
 * Everything here is Russian or Turkmen copy the design already wrote, converted from display
 * strings into typed columns on the way in. Nothing is invented except the codes — categories,
 * builder options, block names — which are ASCII and stable because a translated label must
 * never be able to change what a filter matches (D-10, D-15).
 *
 * No `media` rows and no photographs. There is not one real image in the handoff, and stock
 * imagery needs a licence decision that has not been made (Q-1, Z-7). What is seeded instead
 * is `content_slots`: every position a photograph belongs in, with the art direction that
 * describes it, so each page renders at its true proportions and the gap is a visible list
 * rather than an absence (D-21).
 */

export type SeedCounts = Record<string, number>;

/** The Umrah departure the whole site is built around. */
const DEPART_AT = '2026-09-18 06:00:00';
const RETURN_AT = '2026-09-28 06:00:00';

export async function seedAll(db: Database): Promise<SeedCounts> {
  const counts: SeedCounts = {};
  const record = (table: string, n: number): void => {
    counts[table] = n;
  };

  record('content_slots', await seedContentSlots(db));
  record('tours', await seedTours(db));
  record('hotels', await seedHotels(db));
  record('amenities', await seedAmenities(db));
  record('hotel_rooms', await seedHotelRooms(db));
  record('articles', await seedArticles(db));
  record('gallery_items', await seedGallery(db));
  record('videos', await seedVideos(db));
  record('reviews', await seedReviews(db));
  record('faqs', await seedFaqs(db));
  record('places_to_see', await seedPlaces(db));
  record('content_blocks', await seedContentBlocks(db));
  record('umrah_trips', await seedTrips(db));
  record('umrah_program_days', await seedProgram(db));
  record('ziyarat_places', await seedZiyarat(db));
  record('umrah_groups', await seedGroups(db));
  record('builder', await seedBuilder(db));
  record('settings', await seedSettings(db));

  return counts;
}

// ========================================================================================
// Photographs that do not exist yet
// ========================================================================================

/**
 * Every position a photograph belongs in.
 *
 * Two sources, because the design has two: rows in a data array that carry a `photo` brief
 * beside them, and `<image-slot>` elements written straight into the markup — the heroes, the
 * office picture, the cover of each dark section.
 */
async function seedContentSlots(db: Database): Promise<number> {
  const content = loadContent();
  const values: (typeof t.contentSlots.$inferInsert)[] = [];
  const seen = new Set<string>();

  for (const [screen, declarations] of Object.entries(content.screens)) {
    const target = SCREEN_PAGES[screen];
    if (target === undefined) continue;

    let order = 0;
    for (const value of Object.values(declarations)) {
      if (!Array.isArray(value)) continue;
      for (const item of value as SlottedRow[]) {
        if (typeof item.slot !== 'string' || typeof item.photo !== 'string') continue;
        const key = `${target.site}/${target.page}/${item.slot}`;
        if (seen.has(key)) continue;
        seen.add(key);
        values.push({
          site: target.site,
          page: target.page,
          slotKey: item.slot,
          brief: item.photo,
          sortOrder: (order += 1),
        });
      }
    }
  }

  for (const [screen, slots] of Object.entries(content.imageSlots)) {
    const target = SCREEN_PAGES[screen];
    if (target === undefined) continue;

    let order = 1000;
    for (const slot of slots) {
      const key = `${target.site}/${target.page}/${slot.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      values.push({
        site: target.site,
        page: target.page,
        slotKey: slot.id,
        brief: slot.brief,
        sortOrder: (order += 1),
      });
    }
  }

  await db.insert(t.contentSlots).values(values);
  return values.length;
}

// ========================================================================================
// Global
// ========================================================================================

interface TourRow {
  tag: string;
  cat: string;
  title: string;
  desc: string;
  days: string;
  cities: string;
  stars: string;
  price: string;
}

async function seedTours(db: Database): Promise<number> {
  const source = rows<TourRow>('Charva Tours', 'TOURS');

  const values = source.map((tour, index) => {
    const price = parseMoney(tour.price);
    return {
      slug: slugify(tour.title),
      title: { ru: tour.title },
      summary: { ru: tour.desc },
      tag: { ru: tour.tag },
      category: codeFromLabel(tour.cat, TOUR_CATEGORIES),
      days: parseCount(tour.days, 'days'),
      cities: parseCount(tour.cities, 'cities'),
      hotelStars: parseStars(tour.stars),
      priceFromMinor: price.minor,
      priceCurrency: price.currency,
      // The homepage shows three of the nine. One flag, not a second table.
      isFeatured: index < 3,
      isPublished: true,
      sortOrder: index + 1,
    };
  });

  await db.insert(t.tours).values(values);
  return values.length;
}

interface HotelRow {
  stars: string;
  cat: string;
  name: string;
  city: string;
  price: string;
  desc: string;
  amenities: string[];
}

async function seedAmenities(db: Database): Promise<number> {
  // Built from what the hotels actually list, so the table cannot contain an amenity nothing
  // has and cannot be missing one something does.
  const names = new Set<string>();
  for (const hotel of rows<HotelRow>('Charva Hotels', 'HOTELS')) {
    for (const amenity of hotel.amenities) names.add(amenity);
  }

  const values = [...names].sort().map((name, index) => ({
    code: slugify(name),
    name: { ru: name },
    sortOrder: index + 1,
  }));

  await db.insert(t.amenities).values(values);

  // Then the join rows, matched by code.
  const stored = await db.select().from(t.amenities);
  const byCode = new Map(stored.map((row) => [row.code, row.id]));
  const hotels = await db.select().from(t.hotels);
  const bySlug = new Map(hotels.map((row) => [row.slug, row.id]));

  const links: (typeof t.hotelAmenities.$inferInsert)[] = [];
  for (const hotel of rows<HotelRow>('Charva Hotels', 'HOTELS')) {
    const hotelId = bySlug.get(slugify(hotel.name));
    if (hotelId === undefined) continue;
    for (const amenity of hotel.amenities) {
      const amenityId = byCode.get(slugify(amenity));
      if (amenityId !== undefined) links.push({ hotelId, amenityId });
    }
  }
  if (links.length > 0) await db.insert(t.hotelAmenities).values(links);

  return values.length;
}

/**
 * Which kinds of room each hotel offers, and for how many people.
 *
 * **No prices.** `room_types` itself is inserted by the migration; what a duplex costs at a
 * particular hotel is a commercial fact nobody in this repository knows, and inventing one
 * would put a number on the page that looks researched and is not — the same trap the builder's
 * rates are flagged for in question Q-10. `price_minor` stays null, which the API reads as «the
 * hotel's own nightly price», so the page is correct until an operator fills the real figures
 * in from the admin. That is what this feature is for.
 *
 * The composition follows the category, which is the one thing the seed does know: a yurt camp
 * has yurts, a five-star hotel has a suite, a boutique has rooms rather than suites.
 */
const ROOMS_BY_CATEGORY: Record<string, { code: string; capacity: number; sizeSqm: number }[]> = {
  camp: [{ code: 'yurt', capacity: 4, sizeSqm: 28 }],
  boutique: [
    { code: 'one_room', capacity: 2, sizeSqm: 24 },
    { code: 'two_room', capacity: 3, sizeSqm: 38 },
  ],
  hotel: [
    { code: 'single', capacity: 1, sizeSqm: 18 },
    { code: 'double', capacity: 2, sizeSqm: 26 },
    { code: 'one_room', capacity: 2, sizeSqm: 30 },
  ],
};

/** What a hotel gains on top of the base set as the stars go up. */
const ROOMS_BY_STARS: Record<number, { code: string; capacity: number; sizeSqm: number }[]> = {
  4: [{ code: 'junior_suite', capacity: 2, sizeSqm: 42 }],
  5: [
    { code: 'junior_suite', capacity: 2, sizeSqm: 45 },
    { code: 'duplex', capacity: 4, sizeSqm: 68 },
    { code: 'suite', capacity: 2, sizeSqm: 74 },
  ],
};

async function seedHotelRooms(db: Database): Promise<number> {
  const types = await db.select().from(t.roomTypes);
  const byCode = new Map(types.map((row) => [row.code, row.id]));
  const hotels = await db.select().from(t.hotels);

  const values: (typeof t.hotelRooms.$inferInsert)[] = [];

  for (const hotel of hotels) {
    const base = ROOMS_BY_CATEGORY[hotel.category] ?? [];
    const extra = hotel.stars === null ? [] : (ROOMS_BY_STARS[hotel.stars] ?? []);

    [...base, ...extra].forEach((room, index) => {
      const roomTypeId = byCode.get(room.code);
      if (roomTypeId === undefined) return;
      values.push({
        hotelId: hotel.id,
        roomTypeId,
        capacity: room.capacity,
        sizeSqm: room.sizeSqm,
        sortOrder: index + 1,
      });
    });
  }

  if (values.length > 0) await db.insert(t.hotelRooms).values(values);
  return values.length;
}

async function seedHotels(db: Database): Promise<number> {
  const source = rows<HotelRow>('Charva Hotels', 'HOTELS');

  const values = source.map((hotel, index) => {
    const price = parseMoney(hotel.price);
    const category = HOTEL_CATEGORIES[hotel.cat] ?? 'hotel';
    // The pair the CHECK constraint enforces: a camp has no stars, a hotel must have them.
    const stars = category === 'hotel' ? (parseStars(hotel.stars) ?? parseStars(hotel.cat)) : null;

    return {
      slug: slugify(hotel.name),
      name: { ru: hotel.name },
      summary: { ru: hotel.desc },
      city: { ru: hotel.city },
      stars,
      category,
      priceFromMinor: price.minor,
      priceCurrency: price.currency,
      isPublished: true,
      sortOrder: index + 1,
    };
  });

  await db.insert(t.hotels).values(values);
  return values.length;
}

interface ArticleRow {
  tag: string;
  title: string;
  desc: string;
}

async function seedArticles(db: Database): Promise<number> {
  // The same two articles appear on the homepage and the country page; deduplicated by slug.
  const source = [
    ...rows<ArticleRow>('Charva Travel Global', 'articles'),
    ...rows<ArticleRow>('Charva Turkmenistan', 'articles'),
  ];

  const bySlug = new Map<string, ArticleRow>();
  for (const article of source) bySlug.set(slugify(article.title), article);

  const values = [...bySlug.entries()].map(([slug, article], index) => ({
    slug,
    title: { ru: article.title },
    summary: { ru: article.desc },
    tag: { ru: article.tag },
    isFeatured: index === 0,
    isPublished: true,
    publishedAt: new Date(),
    sortOrder: index + 1,
  }));

  await db.insert(t.articles).values(values);
  return values.length;
}

interface PhotoRow {
  slot: string;
  cat: string;
  col?: string;
  row?: string;
  caption: string;
}

async function seedGallery(db: Database): Promise<number> {
  // Gallery tiles reference a photograph that does not exist yet, so they carry the slot key
  // in place of a media id and are unpublished until one arrives.
  const slots = await db.select().from(t.contentSlots);
  const byKey = new Map(slots.map((slot) => [`${slot.page}/${slot.slotKey}`, slot]));

  const values = rows<PhotoRow>('Charva Gallery', 'PHOTOS')
    .map((photo, index) => {
      const slot = byKey.get(`gallery/${photo.slot}`);
      if (slot === undefined) return undefined;
      return {
        // `media_id` is NOT NULL on this table, so the row waits for its photograph in
        // `content_slots` rather than existing here with a dangling reference.
        mediaId: 0,
        caption: { ru: photo.caption },
        category: codeFromLabel(photo.cat, GALLERY_CATEGORIES),
        spanCols: parseSpan(photo.col),
        spanRows: parseSpan(photo.row),
        isPublished: false,
        sortOrder: index + 1,
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== undefined);

  if (values.length > 0) await db.insert(t.galleryItems).values(values);
  return values.length;
}

interface VideoRow {
  tag: string;
  title: string;
  dur: string;
  views: string;
}

async function seedVideos(db: Database): Promise<number> {
  const values = rows<VideoRow>('Charva Video', 'videos').map((video, index) => ({
    slug: slugify(video.title),
    title: { ru: video.title },
    kind: 'file' as const,
    durationSec: parseDuration(video.dur),
    viewCount: parseViews(video.views),
    category: slugify(video.tag),
    isFeatured: index === 0,
    // Unpublished until the file exists — self-hosting was chosen (Z-5) and nothing is
    // uploaded yet.
    isPublished: false,
    sortOrder: index + 1,
  }));

  await db.insert(t.videos).values(values);
  return values.length;
}

interface ReviewRow {
  rate: number;
  date: string;
  tour: string;
  name: string;
  from: string;
  text: string;
}

async function seedReviews(db: Database): Promise<number> {
  const tours = await db.select().from(t.tours);
  const byTitle = new Map(tours.map((tour) => [tour.slug, tour.id]));

  const values = rows<ReviewRow>('Charva Reviews', 'REVIEWS').map((review, index) => ({
    authorName: review.name,
    authorCity: { ru: review.from },
    rating: review.rate,
    body: { ru: review.text },
    // A real DATE, which is what makes «Сначала новые» sort at all.
    visitedOn: parseMonthYear(review.date),
    tourId: byTitle.get(slugify(review.tour)) ?? null,
    tourTitle: { ru: review.tour },
    status: 'published' as const,
    isPublished: true,
    sortOrder: index + 1,
  }));

  await db.insert(t.reviews).values(values);
  return values.length;
}

async function seedFaqs(db: Database): Promise<number> {
  const values = rows<{ q: string; a: string }>('Charva Contact', 'FAQ').map((faq, index) => ({
    site: 'global' as const,
    question: { ru: faq.q },
    answer: { ru: faq.a },
    isPublished: true,
    sortOrder: index + 1,
  }));

  await db.insert(t.faqs).values(values);
  return values.length;
}

interface PlaceRow {
  region: string;
  name: string;
  desc: string;
}

async function seedPlaces(db: Database): Promise<number> {
  const values = rows<PlaceRow>('Charva Turkmenistan', 'places').map((place, index) => ({
    slug: slugify(place.name),
    name: { ru: place.name },
    region: { ru: place.region },
    description: { ru: place.desc },
    isPublished: true,
    sortOrder: index + 1,
  }));

  await db.insert(t.placesToSee).values(values);
  return values.length;
}

// ========================================================================================
// The seven lists that became one table
// ========================================================================================

async function seedContentBlocks(db: Database): Promise<number> {
  const values: (typeof t.contentBlocks.$inferInsert)[] = [];

  const push = (
    site: 'global' | 'umrah',
    blockCode: string,
    items: { key?: string; value?: string; note?: string }[],
    lang: 'ru' | 'tm',
    featured?: (index: number) => boolean,
  ): void => {
    items.forEach((item, index) => {
      values.push({
        site,
        blockCode,
        keyText: item.key === undefined ? null : { [lang]: item.key },
        valueText: item.value === undefined ? null : { [lang]: item.value },
        note: item.note === undefined ? null : { [lang]: item.note },
        isFeatured: featured?.(index) ?? false,
        sortOrder: index + 1,
      });
    });
  };

  // Eight facts on the country page, seven of which the homepage repeats. One flag, not a
  // second table — that difference is the only difference between the two lists.
  push(
    'global',
    'country_facts',
    rows<{ k: string; v: string }>('Charva Turkmenistan', 'facts').map((fact) => ({
      key: fact.k,
      value: fact.v,
    })),
    'ru',
    (index) => index < 7,
  );

  push(
    'global',
    'visa_steps',
    rows<{ n: string; title: string; desc: string }>('Charva Turkmenistan', 'visa').map((step) => ({
      key: step.title,
      value: step.desc,
      note: step.n,
    })),
    'ru',
  );

  push(
    'umrah',
    'package_items',
    rows<string>('Charva Umrah Packages', 'items').map((item) => ({ key: item })),
    'tm',
  );

  push(
    'umrah',
    'package_conditions',
    rows<{ k: string; v: string }>('Charva Umrah Packages', 'specs').map((spec) => ({
      key: spec.k,
      value: spec.v,
    })),
    'tm',
  );

  push(
    'umrah',
    'package_included',
    rows<string>('Charva Umrah Packages', 'included').map((item) => ({ key: item })),
    'tm',
  );

  push(
    'umrah',
    'signup_order',
    rows<{ n: string; title: string; desc: string }>('Charva Umrah Packages', 'payment').map(
      (step) => ({ key: step.title, value: step.desc, note: step.n }),
    ),
    'tm',
  );

  push(
    'umrah',
    'daily_routine',
    rows<{ t: string; v: string }>('Charva Umrah Program', 'daily').map((slot) => ({
      key: slot.t,
      value: slot.v,
    })),
    'tm',
  );

  await db.insert(t.contentBlocks).values(values);
  return values.length;
}

// ========================================================================================
// Umrah
// ========================================================================================

/**
 * One departure.
 *
 * The date the prototypes hardcode in three JavaScript files and type into eight more. After
 * this it exists once, and `rg "2026-09-18|18\.09\.2026"` finds it only here.
 */
async function seedTrips(db: Database): Promise<number> {
  await db.insert(t.umrahTrips).values({
    departAt: DEPART_AT,
    returnAt: RETURN_AT,
    // Two weeks before departure, which is when the design says the list closes.
    signupClosesAt: '2026-09-04 06:00:00',
    seatsTotal: 45,
    seatsTaken: 33,
    durationDays: 10,
    hotelMekka: { tm: 'Mekge — Harem golaýynda 4★ otel' },
    hotelMedina: { tm: 'Medine — Metjidiň golaýynda 4★ otel' },
    status: 'open',
    // The derived rule normally decides which trip is current; with one row it is also the
    // manual override, so the two agree from the first request.
    isCurrent: true,
    priceMinor: 857_500,
    priceCurrency: 'TMT',
  });
  return 1;
}

async function seedProgram(db: Database): Promise<number> {
  const values = rows<{ day: string; city: string; title: string; desc: string }>(
    'Charva Umrah Program',
    'PROGRAM',
  ).map((day, index) => ({
    dayNumber: Number(day.day),
    title: { tm: day.title },
    description: { tm: day.desc },
    city: { tm: day.city },
    isPublished: true,
    sortOrder: index + 1,
  }));

  await db.insert(t.umrahProgramDays).values(values);
  return values.length;
}

interface ZiyaratRow {
  city: string;
  name: string;
  desc: string;
  time: string;
}

async function seedZiyarat(db: Database): Promise<number> {
  const values = rows<ZiyaratRow>('Charva Umrah Route', 'PLACES').map((place, index) => ({
    slug: slugify(place.name),
    name: { tm: place.name },
    description: { tm: place.desc },
    // Four cities in the data; the prototype's filter offers three and forgets Jidda. The
    // filter is built from `SELECT DISTINCT` over this column, so it cannot happen again.
    city: ZIYARAT_CITIES[place.city] ?? 'mekge',
    durationLabel: { tm: place.time },
    isPublished: true,
    sortOrder: index + 1,
  }));

  await db.insert(t.ziyaratPlaces).values(values);
  return values.length;
}

interface GroupRow {
  id: string;
  label: string;
  short: string;
  date: string;
  people: string;
  desc: string;
  caps: string[];
  vids: { title: string; dur: string }[];
}

async function seedGroups(db: Database): Promise<number> {
  const source = rows<GroupRow>('Charva Umrah Media', 'GROUPS');

  const values = source.map((group, index) => ({
    slug: group.id,
    departedOn: parseDmy(group.date),
    pilgrimsCount: parseCount(group.people, 'pilgrims'),
    label: { tm: group.label },
    shortLabel: { tm: group.short },
    description: { tm: group.desc },
    isPublished: true,
    sortOrder: index + 1,
  }));

  await db.insert(t.umrahGroups).values(values);

  // The captions and the clips exist; the files behind them are photographs of real journeys
  // that only the owner has (Q-1). They are seeded into `content_slots` as briefs, not here,
  // because a `umrah_group_media` row requires a media id.
  const stored = await db.select().from(t.umrahGroups);
  const bySlug = new Map(stored.map((group) => [group.slug, group.id]));

  const slots: (typeof t.contentSlots.$inferInsert)[] = [];
  for (const group of source) {
    if (bySlug.get(group.id) === undefined) continue;
    group.caps.forEach((caption, index) => {
      slots.push({
        site: 'umrah',
        page: 'suratlar',
        slotKey: `${group.id}-photo-${String(index + 1)}`,
        brief: caption,
        sortOrder: index + 1,
      });
    });
    group.vids.forEach((video, index) => {
      slots.push({
        site: 'umrah',
        page: 'suratlar',
        slotKey: `${group.id}-video-${String(index + 1)}`,
        brief: `${video.title} (${video.dur})`,
        sortOrder: 100 + index,
      });
    });
  }
  if (slots.length > 0) await db.insert(t.contentSlots).values(slots);

  return values.length;
}

// ========================================================================================
// The builder
// ========================================================================================

interface StepRow {
  id: string;
  label: string;
  title: string;
  hint: string;
  multi?: boolean;
  form?: boolean;
  options: { name: string; note: string }[];
}

/**
 * Display label to stable code, per step.
 *
 * This table is the whole of decision D-10. The prototype keys its rates by `«3 ★»` and
 * `«3–5»` — strings containing a real star and an en-dash — so translating a label reprices
 * the tour. Nothing below ever reaches an arithmetic expression.
 */
const OPTION_CODES: Record<string, Record<string, string>> = {
  dest: {
    Ашхабад: 'dest_ashgabat',
    Дарваза: 'dest_darvaza',
    'Мары / Мерв': 'dest_merv',
    Куняургенч: 'dest_konye_urgench',
    Йангыкала: 'dest_yangykala',
    Аваза: 'dest_awaza',
  },
  dates: {
    '3 дня': 'nights_3',
    '5 дней': 'nights_5',
    '7 дней': 'nights_7',
    '10 дней': 'nights_10',
    '14 дней': 'nights_14',
    'Свои даты': 'nights_custom',
  },
  hotel: {
    '3 ★': 'hotel_3star',
    '4 ★': 'hotel_4star',
    '5 ★': 'hotel_5star',
    'Бутик-отель': 'hotel_boutique',
    'Юрточный лагерь': 'hotel_yurt',
    Смешанно: 'hotel_mixed',
  },
  food: {
    Халяль: 'food_halal',
    'Национальная кухня': 'food_national',
    Европейская: 'food_european',
    Вегетарианское: 'food_vegetarian',
    'Без глютена': 'food_gluten_free',
    'Без питания': 'food_none',
  },
  transport: {
    'Легковой авто': 'transport_car',
    Минивэн: 'transport_minivan',
    Автобус: 'transport_bus',
    'Внедорожник 4×4': 'transport_suv',
    Поезд: 'transport_train',
    'Внутренний перелёт': 'transport_flight',
  },
  activities: {
    'Экскурсии по городу': 'act_city_tour',
    'Пустыня и кемпинг': 'act_desert_camp',
    'Ахалтекинские кони': 'act_horses',
    Гастротур: 'act_food_tour',
    'Ремёсла и ковры': 'act_crafts',
    'Каспий и пляж': 'act_caspian',
  },
  people: {
    '1': 'pax_1',
    '2': 'pax_2',
    '3–5': 'pax_3_5',
    '6–10': 'pax_6_10',
    '10+': 'pax_10_plus',
    'Пока не знаю': 'pax_unknown',
  },
  guide: {
    Русский: 'guide_ru',
    Английский: 'guide_en',
    Турецкий: 'guide_tr',
    Туркменский: 'guide_tm',
    'Несколько языков': 'guide_multi',
    'Без гида': 'guide_none',
  },
};

/** Nights and group sizes: what the option *means*, kept apart from what it costs. */
const NUMERIC_VALUES: Record<string, number> = {
  nights_3: 3,
  nights_5: 5,
  nights_7: 7,
  nights_10: 10,
  nights_14: 14,
  pax_1: 1,
  pax_2: 2,
  pax_3_5: 4,
  pax_6_10: 8,
  pax_10_plus: 12,
};

/**
 * Options that cannot be held with anything else on their step.
 *
 * One so far. «Без питания» is not a sixth kind of food but the answer that the question does
 * not apply, and the step let it be ticked alongside «Халяль» — a request for halal food and
 * for no food at once.
 */
const EXCLUSIVE_OPTIONS = new Set(['food_none']);

/** Per night, in minor units — the designer's numbers, awaiting confirmation (Q-10). */
const HOTEL_RATES: Record<string, number> = {
  hotel_3star: 4_600,
  hotel_4star: 7_800,
  hotel_5star: 14_500,
  hotel_boutique: 9_600,
  hotel_yurt: 9_500,
  hotel_mixed: 8_800,
};

async function seedBuilder(db: Database): Promise<number> {
  const source = rows<StepRow>('Charva Builder', 'STEPS');

  const stepValues = source.map((step, index) => ({
    // The prototype calls the last step `final`; contracts agrees, so nothing translates.
    code: step.id,
    kind:
      step.form === true
        ? ('form' as const)
        : step.multi === true
          ? ('multi' as const)
          : ('single' as const),
    title: { ru: step.title },
    hint: { ru: step.hint },
    railLabel: { ru: step.label },
    isRequired: step.id === 'dest' || step.id === 'dates' || step.id === 'people',
    sortOrder: index + 1,
  }));

  await db.insert(t.builderSteps).values(stepValues);

  const stored = await db.select().from(t.builderSteps);
  const byCode = new Map(stored.map((step) => [step.code, step.id]));

  const optionValues: (typeof t.builderOptions.$inferInsert)[] = [];
  for (const step of source) {
    const stepId = byCode.get(step.id);
    if (stepId === undefined) continue;

    step.options.forEach((option, index) => {
      const code = OPTION_CODES[step.id]?.[option.name];
      if (code === undefined) {
        throw new Error(
          `No stable code for builder option "${option.name}" in step "${step.id}". ` +
            'Add one to OPTION_CODES — an option keyed by its label would reprice on translation.',
        );
      }

      const rate = HOTEL_RATES[code];
      optionValues.push({
        stepId,
        code,
        name: { ru: option.name },
        note: { ru: option.note },
        numericValue: NUMERIC_VALUES[code] ?? null,
        priceModifierMinor: rate ?? null,
        modifierType: rate !== undefined ? 'per_night' : step.multi === true ? 'per_item' : 'none',
        // «Без питания» is the answer that means the question does not apply, so it cannot be
        // held with «Халяль» — which the step allowed until the owner pointed at it.
        isExclusive: EXCLUSIVE_OPTIONS.has(code),
        sortOrder: index + 1,
      });
    });
  }

  await db.insert(t.builderOptions).values(optionValues);

  const rules = DEFAULT_PRICING_RULES;
  await db.insert(t.pricingRules).values([
    {
      keyName: 'base_fee',
      valueMinor: rules.baseFeeMinor,
      unit: 'minor',
      note: 'Organisation, transfers, paperwork',
    },
    { keyName: 'city_fee', valueMinor: rules.cityFeeMinor, unit: 'minor', note: 'Per city added' },
    {
      keyName: 'activity_fee',
      valueMinor: rules.activityFeeMinor,
      unit: 'minor',
      note: 'Per activity added',
    },
    {
      keyName: 'default_nights',
      valueMinor: rules.defaultNights,
      unit: 'count',
      note: 'Before the visitor chooses',
    },
    {
      keyName: 'default_hotel_rate',
      valueMinor: rules.defaultHotelRateMinor,
      unit: 'minor',
      note: 'The four-star rate',
    },
    {
      keyName: 'default_pax',
      valueMinor: rules.defaultPax,
      unit: 'count',
      note: 'Before the visitor chooses',
    },
  ]);

  return stepValues.length + optionValues.length;
}

// ========================================================================================
// Settings
// ========================================================================================

/**
 * Contacts and identifiers, straight from the prototypes.
 *
 * All of it is placeholder-shaped and none of it has been confirmed — the licence number reads
 * `TM-1428`, and the two sites give different email domains (`charvatravel.com` against
 * `charva.com`). Question Q-12.
 */
async function seedSettings(db: Database): Promise<number> {
  const values: (typeof t.settings.$inferInsert)[] = [
    {
      site: 'global',
      settingKey: 'contacts',
      value: {
        phone: '+993 12 456 789',
        whatsapp: '+993 65 123 456',
        email: 'info@charvatravel.com',
        hours: { ru: 'Пн–Сб, 09:00–18:00' },
        address: { ru: 'Ашхабад, Битарап Туркменистан 42' },
      },
    },
    {
      site: 'global',
      settingKey: 'legal',
      value: { license: 'TM-1428', unconfirmed: true },
    },
    {
      site: 'global',
      settingKey: 'socials',
      value: { instagram: '#', telegram: '#', whatsapp: '#', youtube: '#' },
    },
    {
      site: 'umrah',
      settingKey: 'contacts',
      value: {
        phone: '+993 12 456 789',
        email: 'umrah@charva.com',
        hours: { tm: 'Du–Şe, 09:00–18:00' },
        address: { tm: 'Aşgabat, Bitarap Türkmenistan 42' },
      },
    },
    {
      site: 'umrah',
      settingKey: 'legal',
      value: { license: 'TM-1428', unconfirmed: true },
    },
    {
      site: 'umrah',
      settingKey: 'socials',
      value: { instagram: '#', telegram: '#', whatsapp: '#', youtube: '#' },
    },
  ];

  await db.insert(t.settings).values(values);
  return values.length;
}

/** True when the database still has no content. `db:seed` refuses to run otherwise. */
export async function isEmpty(db: Database): Promise<boolean> {
  const [row] = await db.select({ count: sql<number>`COUNT(*)` }).from(t.contentSlots);
  return (row?.count ?? 0) === 0;
}
