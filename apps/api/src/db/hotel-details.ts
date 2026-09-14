import { eq, inArray, notInArray, sql } from 'drizzle-orm';
import { type MySqlColumn } from 'drizzle-orm/mysql-core';

import { type Database } from './client';
import * as t from './schema';

/**
 * What each of the sixteen real hotels offers, and which kinds of room it lets.
 *
 * The old site carries neither. `mukamly-travel.com` stores a name, a city, an address, a star
 * rating, check-in and check-out, photographs and one paragraph of description per language —
 * and that is the whole of it; there is no amenity table and no room list to import, which is
 * why `import-hotels.ts` brought the hotels over with an empty «Удобства» section and no rooms
 * at all.
 *
 * So the two lists are built here, and they are built from two different kinds of source, which
 * is worth being explicit about because one is a fact and the other is a default:
 *
 * **Amenities are read out of the hotel's own description.** Every code below appears because
 * the paragraph the operator wrote says so — Archabil lists a pool because its description says
 * «an outdoor pool with a relaxation area», and Yyldyz lists nothing but the view because its
 * description says nothing else. A hotel with a thin list has a thin description, and that is
 * the honest state: a five-star hotel almost certainly has parking and Wi-Fi, but «almost
 * certainly» is not something a page should assert about a business a guest is about to book.
 *
 * **Rooms are a default by class**, the same one `seed.ts` applies to the demo catalogue and
 * for the same stated reason: the composition follows the star rating, which is the one thing
 * that is known. Two things are deliberately left empty — `price_minor`, because what a suite
 * costs is a commercial fact nobody in this repository knows (and because the owner took hotel
 * prices off the site entirely), and `size_sqm`, which the demo hotels do carry and these do
 * not. An invented square-metre figure beside a real hotel is a specific false claim rather
 * than a plausible generality, and the page renders correctly without it.
 *
 * Both are editable from the admin panel, which is where the corrections belong.
 */

interface AmenityDef {
  code: string;
  ru: string;
  en: string;
  tr: string;
}

/**
 * The dictionary, in English codes.
 *
 * The demo catalogue's codes were slugified from their Russian labels — `basseyn`, `plyazh`,
 * `parkovka-4-4` — which is what `slugify` does when it is handed a display string, and it made
 * the stable identifier a transliteration of one language's wording. `pool` is what the
 * contract fixtures already assume, and a code is the one part of a row that never changes
 * (D-10), so it should not be written in the language that happened to be typed first.
 */
const AMENITIES: readonly AmenityDef[] = [
  { code: 'restaurant', ru: 'Ресторан', en: 'Restaurant', tr: 'Restoran' },
  { code: 'pool', ru: 'Бассейн', en: 'Swimming pool', tr: 'Havuz' },
  { code: 'spa', ru: 'Спа-центр', en: 'Spa', tr: 'Spa merkezi' },
  { code: 'gym', ru: 'Фитнес-центр', en: 'Fitness centre', tr: 'Fitness merkezi' },
  { code: 'tennis', ru: 'Теннисный корт', en: 'Tennis court', tr: 'Tenis kortu' },
  { code: 'bar', ru: 'Бар', en: 'Bar', tr: 'Bar' },
  { code: 'conference', ru: 'Конференц-зал', en: 'Conference hall', tr: 'Toplantı salonu' },
  { code: 'business_centre', ru: 'Бизнес-центр', en: 'Business centre', tr: 'İş merkezi' },
  { code: 'coworking', ru: 'Коворкинг', en: 'Coworking lounge', tr: 'Ortak çalışma alanı' },
  { code: 'transfer', ru: 'Трансфер', en: 'Transfer', tr: 'Transfer' },
  { code: 'excursions', ru: 'Экскурсии', en: 'Guided tours', tr: 'Turlar' },
  { code: 'museum', ru: 'Музей', en: 'Museum', tr: 'Müze' },
  { code: 'tea_house', ru: 'Чайхана', en: 'Tea house', tr: 'Çayhane' },
  { code: 'garden', ru: 'Сад', en: 'Garden', tr: 'Bahçe' },
  { code: 'park', ru: 'Частный парк', en: 'Private park', tr: 'Özel park' },
  { code: 'kids_room', ru: 'Детская комната', en: 'Kids’ playroom', tr: 'Çocuk oyun odası' },
  { code: 'family', ru: 'Для семей с детьми', en: 'Family-friendly', tr: 'Aile dostu' },
  { code: 'city_centre', ru: 'В центре города', en: 'City centre', tr: 'Şehir merkezinde' },
  { code: 'panoramic_view', ru: 'Панорамный вид', en: 'Panoramic view', tr: 'Panoramik manzara' },
  { code: 'butler', ru: 'Дворецкий 24/7', en: '24/7 butler service', tr: '7/24 kat hizmeti' },
  { code: 'bicycles', ru: 'Велосипеды', en: 'Bicycles', tr: 'Bisiklet' },
  { code: 'eco', ru: 'Эко-отель', en: 'Eco-hotel', tr: 'Eko otel' },
  { code: 'campfire', ru: 'Вечера у костра', en: 'Campfire evenings', tr: 'Kamp ateşi akşamları' },
];

/**
 * Hotel slug to amenity codes, each one traceable to a sentence in that hotel's description.
 *
 * The quoted fragment beside each list is the part of the description it was read from. It is
 * there so the next person can check the claim rather than trust it, and so that a description
 * the owner rewrites in the admin can be compared against what this file asserted.
 */
const AMENITIES_BY_HOTEL: Record<string, readonly string[]> = {
  // «its apartments offer the best panoramic views of Ashgabat» — and nothing further.
  'yyldyz-hotel': ['panoramic_view'],
  // «24/7 butler service, a world-class chef restaurant, a spa with Eastern bath rituals, a
  // private park with fountains, and smart-tech conference halls»
  'oguzkent-hotel': ['butler', 'restaurant', 'spa', 'park', 'conference'],
  // «spacious rooms with panoramic windows, a restaurant serving local cuisine, an outdoor pool
  // with a relaxation area, and a business center»
  'archabil-hotel': ['panoramic_view', 'restaurant', 'pool', 'business_centre'],
  // «a modern fitness center, indoor pool, tennis and squash courts, and a sports-themed bar»
  'olimpiya-hotel': ['gym', 'pool', 'tennis', 'bar'],
  // «a modern gym, Olympic-size swimming pool, tennis courts and active recreation»
  'sport-hotel': ['gym', 'pool', 'tennis'],
  // «proximity to the main attractions … a restaurant with national cuisine, conference rooms
  // and a spa center»
  'ashgabat-hotel': ['city_centre', 'restaurant', 'conference', 'spa'],
  // «in the heart of the capital … elegant rooms with panoramic views, a Michelin-starred
  // restaurant, an exclusive spa complex, and premium conference halls»
  'grand-hotel': ['city_centre', 'panoramic_view', 'restaurant', 'spa', 'conference'],
  // «a coworking lounge, a fitness center with panoramic views, a Mediterranean restaurant, and
  // airport transfers»
  'diwan-hotel': ['coworking', 'gym', 'panoramic_view', 'restaurant', 'transfer'],
  // «Perfect for family stays: spacious rooms, a kids’ playroom, a restaurant serving homemade
  // dishes, and a garden with picnic areas»
  'bagt-koshgi-hotel': ['family', 'kids_room', 'restaurant', 'garden'],
  // «a restaurant with Turkmen and Khorezm cuisine, and tours to UNESCO World Heritage Sites»
  'uzboy-hotel': ['restaurant', 'excursions'],
  // «a restaurant serving Khorezm pilaf, transfer/excursion services. The courtyard features a
  // traditional Central Asian tea house»
  'dashoguz-hotel': ['restaurant', 'transfer', 'excursions', 'tea_house'],
  // «a lobby museum, and a tea garden. We arrange tours to Merv's citadels»
  'mary-hotel': ['museum', 'tea_house', 'excursions'],
  // «Margiana Museum, lectures by archaeologists. We arrange expeditions to necropolises»
  'margush-hotel': ['museum', 'excursions'],
  // «spa with naphthalan therapies, and an «Oil & Spice» cocktail bar … VR-equipped conference
  // halls, transfers to oil terminals»
  'nebitchi-hotel': ['spa', 'bar', 'conference', 'transfer'],
  // «Turkmenistan's first eco-hotel … organic restaurant with local produce, spa using Caspian
  // seaweed wraps, cycling along eco-trails … tours to Hazar Reserve»
  'charlak-hotel': ['eco', 'restaurant', 'spa', 'bicycles', 'excursions'],
  // «a Silk Road museum, tours to Amul and Chardzhou archaeological sites … storytelling by the
  // fire with dutar music»
  'yupek-yoly': ['museum', 'excursions', 'campfire'],
};

interface RoomDef {
  code: string;
  capacity: number;
}

/** Every hotel lets these, whatever its class. */
const ROOMS_BASE: readonly RoomDef[] = [
  { code: 'single', capacity: 1 },
  { code: 'double', capacity: 2 },
  { code: 'one_room', capacity: 2 },
];

/** What a hotel gains on top of the base set as the stars go up — as in `seed.ts`. */
const ROOMS_BY_STARS: Record<number, readonly RoomDef[]> = {
  4: [{ code: 'junior_suite', capacity: 2 }],
  5: [
    { code: 'junior_suite', capacity: 2 },
    { code: 'duplex', capacity: 4 },
    { code: 'suite', capacity: 2 },
  ],
};

export interface HotelDetailCounts {
  amenities: number;
  links: number;
  rooms: number;
  unmatched: string[];
}

/**
 * Bring the dictionary, the links and the room lists into line with the tables above.
 *
 * Written as a reconciliation rather than as an insert, because it runs twice: once at the end
 * of the import that creates the hotels, and again on its own against a database where they
 * already exist. Amenities are matched by code and updated in place, so a row an editor has
 * already linked keeps its id.
 */
export async function syncHotelDetails(db: Database): Promise<HotelDetailCounts> {
  const hotels = await db
    .select({ id: t.hotels.id, slug: t.hotels.slug, stars: t.hotels.stars })
    .from(t.hotels);

  // Only the hotels this file describes are rewritten. A seventeenth hotel entered from the
  // admin panel keeps whatever an editor gave it: this is a reconciliation of what is written
  // here, not a claim to own the two tables.
  const known = hotels.filter((row) => AMENITIES_BY_HOTEL[row.slug] !== undefined);
  const knownIds = known.map((row) => row.id);
  const allIds = hotels.map((row) => row.id);
  const unmatched = hotels.filter((row) => !known.includes(row)).map((row) => row.slug);

  // --- the dictionary --------------------------------------------------------------------
  const existing = await db.select().from(t.amenities);
  const byCode = new Map(existing.map((row) => [row.code, row.id]));

  for (const [index, amenity] of AMENITIES.entries()) {
    const name = { ru: amenity.ru, en: amenity.en, tr: amenity.tr };
    const id = byCode.get(amenity.code);
    if (id === undefined) {
      const [inserted] = await db
        .insert(t.amenities)
        .values({ code: amenity.code, name, sortOrder: index + 1 });
      byCode.set(amenity.code, inserted.insertId);
    } else {
      // Matched by code, updated in place: an id an editor has already linked stays valid.
      await db
        .update(t.amenities)
        .set({ name, sortOrder: index + 1 })
        .where(eq(t.amenities.id, id));
    }
  }

  // --- the links -------------------------------------------------------------------------
  if (knownIds.length > 0) {
    await db.delete(t.hotelAmenities).where(inArray(t.hotelAmenities.hotelId, knownIds));
    await db.delete(t.hotelRooms).where(inArray(t.hotelRooms.hotelId, knownIds));
  }
  // Rows left behind by hotels that no longer exist. The import deletes a hotel's links along
  // with the hotel, so anything still pointing at a missing id predates that — and it would
  // keep an amenity looking used for ever, which is what stops the clean-up below.
  await db.delete(t.hotelAmenities).where(missingHotel(t.hotelAmenities.hotelId, allIds));
  await db.delete(t.hotelRooms).where(missingHotel(t.hotelRooms.hotelId, allIds));

  const links: (typeof t.hotelAmenities.$inferInsert)[] = [];
  for (const hotel of known) {
    for (const code of AMENITIES_BY_HOTEL[hotel.slug] ?? []) {
      const amenityId = byCode.get(code);
      if (amenityId !== undefined) links.push({ hotelId: hotel.id, amenityId });
    }
  }
  if (links.length > 0) await db.insert(t.hotelAmenities).values(links);

  // --- the rooms -------------------------------------------------------------------------
  const types = await db.select({ id: t.roomTypes.id, code: t.roomTypes.code }).from(t.roomTypes);
  const typeByCode = new Map(types.map((row) => [row.code, row.id]));

  const rooms: (typeof t.hotelRooms.$inferInsert)[] = [];
  for (const hotel of known) {
    const extra = hotel.stars === null ? [] : (ROOMS_BY_STARS[hotel.stars] ?? []);
    [...ROOMS_BASE, ...extra].forEach((room, index) => {
      const roomTypeId = typeByCode.get(room.code);
      if (roomTypeId === undefined) return;
      rooms.push({
        hotelId: hotel.id,
        roomTypeId,
        capacity: room.capacity,
        // Null on both, and both deliberately — see the note at the top of this file.
        priceMinor: null,
        sizeSqm: null,
        sortOrder: index,
      });
    });
  }
  if (rooms.length > 0) await db.insert(t.hotelRooms).values(rooms);

  // --- what nothing uses any more ----------------------------------------------------------
  // The transliterated codes the demo catalogue left behind. Deleted rather than kept, because
  // an amenity no hotel has is a filter chip leading to an empty grid (D-15).
  const stillLinked = new Set((await db.select().from(t.hotelAmenities)).map((r) => r.amenityId));
  const stale = existing
    .filter((row) => !AMENITIES.some((a) => a.code === row.code))
    .filter((row) => !stillLinked.has(row.id))
    .map((row) => row.id);
  if (stale.length > 0) await db.delete(t.amenities).where(inArray(t.amenities.id, stale));

  return { amenities: AMENITIES.length, links: links.length, rooms: rooms.length, unmatched };
}

/**
 * «Belongs to a hotel that is not there».
 *
 * `notInArray` with an empty list is not valid SQL, and an empty hotel table is exactly the
 * case where every remaining link is an orphan — so the two are separate expressions.
 */
function missingHotel(column: MySqlColumn, hotelIds: number[]) {
  return hotelIds.length === 0 ? sql`1 = 1` : notInArray(column, hotelIds);
}
