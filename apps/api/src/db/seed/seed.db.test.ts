import { DEFAULT_PRICING_RULES, formatMoney, quote } from '@charva/contracts';
import mysql from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb } from '../client';
import * as t from '../schema';
import { TEST_DATABASE_URL } from '../test-setup';

import { isEmpty, seedAll } from './seed';

/**
 * What the seed produced, checked against what the design says.
 *
 * The point is not that rows exist. It is that the display strings the prototypes carry became
 * the right numbers — that «8 дней» is an 8, «1 190 $» is 119 000 minor units, «Май 2026»
 * sorts, and «6:12» is 372 seconds. A wrong number here does not look like a bug; it looks
 * like a tour that is quietly six days long.
 */

let pool: mysql.Pool;
let db: ReturnType<typeof createDb>;

beforeAll(async () => {
  pool = mysql.createPool({ uri: TEST_DATABASE_URL, timezone: 'Z', connectionLimit: 5 });
  db = createDb(pool);

  // The constraints suite leaves rows behind; start from a known-empty catalogue.
  for (const table of [
    'hotel_amenities',
    'amenities',
    'tour_media',
    'tour_days',
    'tours',
    'hotels',
    'articles',
    'gallery_items',
    'videos',
    'reviews',
    'faqs',
    'places_to_see',
    'content_blocks',
    'content_slots',
    'umrah_group_media',
    'umrah_groups',
    'ziyarat_places',
    'umrah_program_days',
    'umrah_trips',
    'builder_options',
    'builder_steps',
    'pricing_rules',
    'settings',
    'media',
  ]) {
    await pool.query(`DELETE FROM \`${table}\``);
  }

  await seedAll(db);
}, 60_000);

afterAll(async () => {
  await pool.end();
});

describe('the catalogue', () => {
  it('holds the nine tours the design describes', async () => {
    const tours = await db.select().from(t.tours);
    expect(tours).toHaveLength(9);

    const classic = tours.find((tour) => tour.slug === 'klassicheskiy-turkmenistan');
    expect(classic?.title).toEqual({ ru: 'Классический Туркменистан' });
    // «8 дней» / «5 городов» / «1 190 $» as numbers, which is the whole exercise.
    expect(classic?.days).toBe(8);
    expect(classic?.cities).toBe(5);
    expect(classic?.priceFromMinor).toBe(119_000);
    expect(formatMoney({ minor: classic?.priceFromMinor ?? 0, currency: 'USD' })).toBe('1 190 $');
  });

  it('keeps the camp and the boutique out of the star ratings', async () => {
    const hotels = await db.select().from(t.hotels);
    expect(hotels).toHaveLength(9);

    const camp = hotels.find((hotel) => hotel.slug === 'garagum-camp');
    expect(camp?.category).toBe('camp');
    expect(camp?.stars).toBeNull();

    const boutique = hotels.find((hotel) => hotel.slug === 'nisa-boutique');
    expect(boutique?.category).toBe('boutique');
    expect(boutique?.stars).toBeNull();

    // And every ordinary hotel does have one, which is the other half of the CHECK.
    for (const hotel of hotels.filter((row) => row.category === 'hotel')) {
      expect(hotel.stars, hotel.slug).not.toBeNull();
    }
  });

  it('gives reviews a date that sorts', async () => {
    // The prototype stores «Май 2026» as a string, which is exactly why its "newest first"
    // filter does nothing at all.
    const reviews = await db.select().from(t.reviews);
    expect(reviews).toHaveLength(9);

    const dates = reviews.map((review) => review.visitedOn).filter((date) => date !== null);
    expect(dates).toHaveLength(9);
    const sorted = [...dates].sort();
    expect(sorted[0]?.length).toBe(10);
    expect(sorted.at(-1) ?? '').toMatch(/^\d{4}-\d{2}-01$/);
  });

  it('stores a video duration as seconds', async () => {
    const videos = await db.select().from(t.videos);
    expect(videos).toHaveLength(6);
    for (const video of videos) {
      expect(video.durationSec, JSON.stringify(video.title)).toBeGreaterThan(0);
    }
  });

  it('builds the amenity list from what the hotels actually have', async () => {
    // `hotels.amenities JSON` holding Russian strings, as the proposal has it, is neither
    // translatable nor filterable.
    const amenities = await db.select().from(t.amenities);
    const links = await db.select().from(t.hotelAmenities);
    expect(amenities.length).toBeGreaterThan(10);
    expect(links.length).toBeGreaterThan(20);
  });
});

describe('the missing photographs', () => {
  it('records every position one belongs in', async () => {
    // 151 briefs and not one image. As rows they are a checklist rather than an absence —
    // decision D-21, question Q-1.
    const slots = await db.select().from(t.contentSlots);
    expect(slots.length).toBeGreaterThan(150);
    for (const slot of slots) {
      expect(slot.brief.length, slot.slotKey).toBeGreaterThan(0);
      expect(slot.mediaId, slot.slotKey).toBeNull();
    }
  });

  it('seeds no media at all, because there is none', async () => {
    // Stock imagery needs a licence decision nobody has made (Z-7, Q-1). Until then every page
    // renders at its true proportions with a branded placeholder, and nothing pretends.
    const media = await db.select().from(t.media);
    expect(media).toHaveLength(0);
  });
});

describe('the Umrah departure', () => {
  it('exists exactly once and drives everything', async () => {
    // The date the prototypes hardcode in three JavaScript files and type into eight more.
    const trips = await db.select().from(t.umrahTrips);
    expect(trips).toHaveLength(1);

    const trip = trips[0];
    expect(trip?.status).toBe('open');
    expect(trip?.isCurrent).toBe(true);
    expect(trip?.seatsTotal).toBe(45);
    expect(trip?.seatsTaken).toBe(33);
    // 33 of 45 is 73.33%, not the literal 73% the prototype draws beside it.
    expect(((trip?.seatsTaken ?? 0) / (trip?.seatsTotal ?? 1)) * 100).toBeCloseTo(73.33, 1);
  });

  it('has ten programme days and nine places, across four cities', async () => {
    expect(await db.select().from(t.umrahProgramDays)).toHaveLength(10);

    const places = await db.select().from(t.ziyaratPlaces);
    expect(places).toHaveLength(9);

    // Four cities, including the Jidda the prototype's hardcoded filter forgets — which is
    // what building filters from the data prevents (D-15).
    const cities = new Set(places.map((place) => place.city));
    expect([...cities].sort()).toEqual(['bedir', 'jidda', 'medine', 'mekge']);
  });

  it('keeps the price out of nothing but the admin column', async () => {
    // It exists — `umrah_trips.price_minor` — and never appears in a public response schema.
    // Decision D-12 is enforced by the serialiser in phase 3; this only checks the seed is
    // honest about there being a price at all.
    const [trip] = await db.select().from(t.umrahTrips);
    expect(trip?.priceMinor).toBe(857_500);
    expect(trip?.priceCurrency).toBe('TMT');
  });
});

describe('the builder', () => {
  it('has nine steps and every option keyed by a stable code', async () => {
    const steps = await db.select().from(t.builderSteps);
    const options = await db.select().from(t.builderOptions);

    expect(steps).toHaveLength(9);
    expect(options).toHaveLength(48);

    // ASCII only, and nothing that could be a translated label — decision D-10. The prototype
    // keys its rate table by `«3 ★»` and `«3–5»`.
    for (const option of options) {
      expect(option.code, option.code).toMatch(/^[a-z0-9_]+$/);
    }
  });

  it('separates what an option means from what it costs', async () => {
    const options = await db.select().from(t.builderOptions);
    const byCode = new Map(options.map((option) => [option.code, option]));

    expect(byCode.get('nights_7')?.numericValue).toBe(7);
    expect(byCode.get('nights_7')?.priceModifierMinor).toBeNull();

    expect(byCode.get('hotel_4star')?.priceModifierMinor).toBe(7_800);
    expect(byCode.get('hotel_4star')?.numericValue).toBeNull();

    // «6–10» means eight people, «10+» means twelve — the numbers Q-10 asks about.
    expect(byCode.get('pax_6_10')?.numericValue).toBe(8);
    expect(byCode.get('pax_10_plus')?.numericValue).toBe(12);
  });

  it('prices an untouched builder at 1 296 $ from the seeded rates', async () => {
    // The phase's headline acceptance criterion, run against the database rather than against
    // the defaults in contracts: what a visitor sees before their first click.
    const options = await db.select().from(t.builderOptions);
    const steps = await db.select().from(t.builderSteps);
    const stepById = new Map(steps.map((step) => [step.id, step.code]));
    const rules = await db.select().from(t.pricingRules);
    const byKey = new Map(rules.map((rule) => [rule.keyName, rule.valueMinor]));

    const result = quote(
      {},
      {
        options: options.map((option) => ({
          code: option.code,
          step: (stepById.get(option.stepId) ?? 'dest') as 'dest',
          numericValue: option.numericValue,
          priceModifierMinor: option.priceModifierMinor,
          modifierType: option.modifierType,
        })),
        rules: {
          baseFeeMinor: byKey.get('base_fee') ?? 0,
          cityFeeMinor: byKey.get('city_fee') ?? 0,
          activityFeeMinor: byKey.get('activity_fee') ?? 0,
          defaultNights: byKey.get('default_nights') ?? 0,
          defaultHotelRateMinor: byKey.get('default_hotel_rate') ?? 0,
          defaultPax: byKey.get('default_pax') ?? 0,
          currency: 'USD',
        },
      },
    );

    expect(result.total.minor).toBe(129_600);
    expect(formatMoney(result.total)).toBe('1 296 $');
  });

  it('seeds the rates contracts falls back to', async () => {
    const rules = await db.select().from(t.pricingRules);
    const byKey = new Map(rules.map((rule) => [rule.keyName, rule.valueMinor]));

    expect(byKey.get('base_fee')).toBe(DEFAULT_PRICING_RULES.baseFeeMinor);
    expect(byKey.get('city_fee')).toBe(DEFAULT_PRICING_RULES.cityFeeMinor);
    expect(byKey.get('activity_fee')).toBe(DEFAULT_PRICING_RULES.activityFeeMinor);
  });
});

describe('the seed guard', () => {
  it('knows the database is no longer empty', async () => {
    // Seeding twice would collide on every unique slug and double every list.
    expect(await isEmpty(db)).toBe(false);
  });
});
