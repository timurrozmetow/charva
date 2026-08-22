import { DEFAULT_PRICING_RULES, formatMoney, quote } from '@charva/contracts';
import { eq } from 'drizzle-orm';
import mysql from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb } from '../client';
import * as t from '../schema';
import { TEST_DATABASE_URL } from '../test-setup';

import { isEmpty, seedAll, SEEDED_TABLES } from './seed';

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

  // The constraints suite leaves rows behind; start from a known-empty catalogue. The list is
  // the seeder's own, so a table added to it cannot be missed here — it was, once.
  for (const table of SEEDED_TABLES) {
    await pool.query(`DELETE FROM \`${table}\``);
  }

  await seedAll(db);
}, 60_000);

afterAll(async () => {
  await pool.end();
});

describe('the catalogue', () => {
  it('holds the nine tours the design describes, and the one that is real', async () => {
    const tours = await db.select().from(t.tours);
    // Nine invented to fill a layout, plus the operator's own tour sheet. The demo rows are
    // meant to be deleted the week the site goes live; the tenth is not — see `owner-content.ts`.
    expect(tours).toHaveLength(10);

    const classic = tours.find((tour) => tour.slug === 'klassicheskiy-turkmenistan');
    expect(classic?.title).toEqual({ ru: 'Классический Туркменистан' });
    // «8 дней» / «5 городов» / «1 190 $» as numbers, which is the whole exercise.
    expect(classic?.days).toBe(8);
    expect(classic?.cities).toBe(5);
    expect(classic?.priceFromMinor).toBe(119_000);
    expect(formatMoney({ minor: classic?.priceFromMinor ?? 0, currency: 'USD' })).toBe('1 190 $');
  });

  it('carries the operator’s own tour sheet whole, price tiers and all', async () => {
    /*
     * The first content in this repository that somebody is actually selling.
     *
     * Worth a test of its own because a mistake here does not look like a bug — it looks like a
     * tour that quietly costs the wrong money, or a day that lost three of its five lines.
     */
    const [tour] = await db.select().from(t.tours).where(eq(t.tours.slug, 'turkmenistan-5-days'));
    expect(tour).toBeDefined();
    expect(tour?.days).toBe(5);
    // The sheet says «Hotel, camp» and never names a class, so neither does the row.
    expect(tour?.hotelStars).toBeNull();

    const days = await db.select().from(t.tourDays).where(eq(t.tourDays.tourId, tour!.id));
    expect(days).toHaveLength(5);
    // Five days written as lists: the newlines are the list, and losing them turns a day into
    // one run-on sentence.
    const first = days.find((day) => day.dayNumber === 1);
    expect(first?.description?.ru?.split('\n')).toHaveLength(5);

    const lines = await db
      .select()
      .from(t.tourInclusions)
      .where(eq(t.tourInclusions.tourId, tour!.id));
    expect(lines.filter((line) => line.kind === 'included')).toHaveLength(6);
    expect(lines.filter((line) => line.kind === 'excluded')).toHaveLength(4);

    const prices = await db.select().from(t.tourPrices).where(eq(t.tourPrices.tourId, tour!.id));
    expect(prices.map((tier) => [tier.pax, tier.priceMinor])).toEqual([
      [1, 100_000],
      [2, 93_000],
      [3, 87_000],
      [4, 83_000],
    ]);

    // «от 830 $» is the cheapest tier rather than a number below every tier — a price nobody
    // can pay would be the worst of the three possible readings.
    expect(tour?.priceFromMinor).toBe(Math.min(...prices.map((tier) => tier.priceMinor)));
    // Matched rather than compared: the separator `formatMoney` puts before the sign is a
    // non-breaking space, and pinning an invisible character here would test the wrong thing.
    expect(formatMoney({ minor: tour?.priceFromMinor ?? 0, currency: 'USD' })).toMatch(/^830\s\$$/);
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
    // Briefs, and not one image. As rows they are a checklist rather than an absence —
    // decision D-21, question Q-1. Seven fewer than there once were: the hero briefs moved to
    // `hero_slides`, so that a photograph has one home rather than two.
    const slots = await db.select().from(t.contentSlots);
    expect(slots.length).toBeGreaterThan(140);
    for (const slot of slots) {
      expect(slot.brief.length, slot.slotKey).toBeGreaterThan(0);
      expect(slot.mediaId, slot.slotKey).toBeNull();
    }
  });

  it('leaves no hero slot behind for an upload to disappear into', async () => {
    /*
     * The failure this guards against was invisible from the inside.
     *
     * While the hero read `place.cover ?? slot.media`, an editor could upload into `g-hero-1`
     * and see nothing change, because the place above it in the chain already had a cover. The
     * slot is gone rather than merely unread: a position in the admin's photograph checklist
     * that no page renders is a trap, and it stays a trap for as long as it is listed.
     */
    const slots = await db.select().from(t.contentSlots);
    const heroes = slots.filter((slot) => /^[gu]-hero-/.test(slot.slotKey));
    expect(heroes).toEqual([]);
  });

  it('gives each homepage slide a caption and a brief of its own', async () => {
    /*
     * The list the design always had, and the first version of both homepages ignored.
     *
     * `SLIDES` sits in the export beside `places`, carrying a label and a photo brief per slide.
     * Reading the hero out of `places_to_see` and `ziyarat_places` instead put the caption in a
     * foreign entity — so a slide could not be renamed, reordered or repictured without editing
     * another page — and it silently dropped Umrah's third slide, «Topar», which is a group in
     * ihram and not a ziyarat place at all.
     */
    const slides = await db.select().from(t.heroSlides);

    const global = slides.filter((slide) => slide.site === 'global');
    const umrah = slides.filter((slide) => slide.site === 'umrah');
    expect(global).toHaveLength(4);
    expect(umrah).toHaveLength(3);

    expect(global.map((slide) => slide.title.ru)).toEqual([
      'Дарваза',
      'Йангыкала',
      'Ашхабад',
      'Мерв',
    ]);
    // The slide that could not exist while the hero read from `ziyarat_places`.
    expect(umrah.map((slide) => slide.title.tm)).toEqual(['Mekge', 'Medine', 'Topar']);

    for (const slide of slides) {
      expect(slide.brief ?? '', JSON.stringify(slide.title)).not.toBe('');
      // Like every other seeded row: the position exists, the photograph does not (Q-1).
      expect(slide.mediaId, JSON.stringify(slide.title)).toBeNull();
      expect(slide.sortOrder).toBeGreaterThan(0);
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
