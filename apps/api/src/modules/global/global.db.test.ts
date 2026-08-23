import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { API_PREFIX } from '../../app';
import { buildTestApp, problem, type TestApp } from '../../test/app';

/**
 * What the Global catalogue answers, and the two rules that shape all of it.
 *
 * Every number the design prints as a literal is counted here instead — «46 отелей»,
 * «214 отзывов», «92% советуют» (decision D-6) — and every filter chip is built from the rows
 * that exist rather than written down (D-15). The prototype's own literals already contradict
 * its nine rows of data, which is what makes this worth testing rather than assuming.
 */

let context: TestApp;

beforeAll(async () => {
  context = await buildTestApp();
}, 60_000);

afterAll(async () => {
  await context.close();
});

async function get<T>(path: string): Promise<T> {
  const response = await context.app.inject({ method: 'GET', url: `${API_PREFIX}${path}` });
  expect(response.statusCode, `${path} → ${response.body.slice(0, 200)}`).toBe(200);
  return response.json<T>();
}

describe('the tour catalogue', () => {
  it('counts what it has rather than claiming thirty-two', async () => {
    const body = await get<{ items: unknown[]; meta: { total: number } }>('/global/tours');

    // Nine from the prototype's demo catalogue and one the owner actually sells.
    expect(body.meta.total).toBe(10);
    expect(body.items).toHaveLength(10);
  });

  it('builds its chips from the categories that actually have tours', async () => {
    const body = await get<{ facets: { categories: { code: string; count: number }[] } }>(
      '/global/tours',
    );

    expect(body.facets.categories.length).toBeGreaterThan(1);
    for (const facet of body.facets.categories) {
      // No chip may lead to an empty grid — which is guaranteed rather than checked, because a
      // chip only exists if there are rows behind it.
      expect(facet.count, facet.code).toBeGreaterThan(0);

      const filtered = await get<{ meta: { total: number } }>(
        `/global/tours?category=${facet.code}`,
      );
      expect(filtered.meta.total, facet.code).toBe(facet.count);
    }
  });

  it('sorts by price using the number rather than the rendered string', async () => {
    const body = await get<{ items: { priceFrom: { minor: number } }[] }>(
      '/global/tours?sort=price_asc',
    );
    const prices = body.items.map((item) => item.priceFrom.minor);

    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  it('sends money as an integer and a currency, never as a formatted string', async () => {
    const body = await get<{ items: { priceFrom: { minor: number; currency: string } }[] }>(
      '/global/tours',
    );
    const first = body.items[0];

    expect(Number.isInteger(first?.priceFrom.minor)).toBe(true);
    expect(first?.priceFrom.currency).toBe('USD');
  });

  it('answers a detail page with the programme and three related tours', async () => {
    const body = await get<{
      slug: string;
      itinerary: { dayNumber: number }[];
      related: { slug: string }[];
    }>('/global/tours/klassicheskiy-turkmenistan');

    expect(body.slug).toBe('klassicheskiy-turkmenistan');
    expect(body.related.length).toBeLessThanOrEqual(3);
    expect(body.related.map((tour) => tour.slug)).not.toContain(body.slug);
  });

  it('answers what the price covers, what it does not, and what a party of four pays', async () => {
    /*
     * The one tour in the catalogue that is a real commercial offer rather than a demo row.
     *
     * Question Q-20 asked the owner for the composition of a tour price and the answer arrived as
     * a tour sheet, so the page that used to print one figure and defer the rest to a manager now
     * prints the sheet. The tiers fall as the party grows because a guide and a car cost the same
     * for one traveller as for four.
     */
    const body = await get<{
      priceFrom: { minor: number; currency: string };
      included: string[];
      excluded: string[];
      prices: { pax: number; price: { minor: number; currency: string } }[];
      itinerary: { dayNumber: number; description: string }[];
    }>('/global/tours/turkmenistan-5-days');

    expect(body.included).toContain('Профессиональный англоговорящий гид');
    expect(body.excluded).toContain('Страховка');

    expect(body.prices.map((tier) => tier.pax)).toEqual([1, 2, 3, 4]);
    expect(body.prices.map((tier) => tier.price.minor)).toEqual([100000, 93000, 87000, 83000]);

    // «от 830 $» is the last tier, not a number below every tier: a price nobody can pay is
    // worse than no price at all.
    expect(body.priceFrom.minor).toBe(83000);
    // Every tier is quoted in the tour's own currency — `tour_prices` has no column that could
    // disagree with it.
    for (const tier of body.prices) expect(tier.price.currency).toBe(body.priceFrom.currency);

    // Five days, and each one a list rather than a paragraph — the newlines survive the column.
    expect(body.itinerary).toHaveLength(5);
    expect(body.itinerary[0]?.description).toContain('\n');
  });

  it('sends empty lists for a tour nobody has written a price sheet for', async () => {
    // Eight of the nine demo tours have neither, and the page has to read as a tour without a
    // published composition rather than as one that failed to load.
    const body = await get<{ included: string[]; excluded: string[]; prices: unknown[] }>(
      '/global/tours/klassicheskiy-turkmenistan',
    );

    expect(body.included).toEqual([]);
    expect(body.excluded).toEqual([]);
    expect(body.prices).toEqual([]);
  });

  it('404s a slug nobody published, in the single error envelope', async () => {
    const response = await context.app.inject({
      method: 'GET',
      url: `${API_PREFIX}/global/tours/no-such-tour`,
    });

    expect(response.statusCode).toBe(404);
    const body = problem(response);
    expect(body.error.code).toBe('not_found');
    // The id is what ties a failure somebody reports over the phone to a line in the log.
    expect(body.error.requestId).toBeTruthy();
  });
});

describe('hotels', () => {
  it('derives the filter key, so a camp cannot also be three stars', async () => {
    /*
     * The contradiction this resolves: the prototype shows a yurt camp as «3★» on its card and
     * «Кемп» in the filter — two facts about one row that cannot both be true.
     */
    const body = await get<{
      items: { slug: string; stars: number | null; category: string; filterKey: string }[];
    }>('/global/hotels');

    for (const hotel of body.items) {
      if (hotel.category === 'hotel') {
        expect(hotel.stars, hotel.slug).not.toBeNull();
        expect(hotel.filterKey).toBe(`${String(hotel.stars)}star`);
      } else {
        expect(hotel.stars, hotel.slug).toBeNull();
        expect(hotel.filterKey).toBe(hotel.category);
      }
    }
  });

  it('filters on that derived key', async () => {
    const all = await get<{ facets: { categories: { code: string; count: number }[] } }>(
      '/global/hotels',
    );

    for (const facet of all.facets.categories) {
      const filtered = await get<{ items: { filterKey: string }[]; meta: { total: number } }>(
        `/global/hotels?filter=${facet.code}`,
      );
      expect(filtered.meta.total, facet.code).toBe(facet.count);
      for (const hotel of filtered.items) expect(hotel.filterKey).toBe(facet.code);
    }
  });

  it('carries amenities as codes with translatable names', async () => {
    // `hotels.amenities JSON` holding Russian strings, as the handoff proposes, is neither
    // translatable nor filterable.
    const body = await get<{ items: { amenities: { code: string; name: string }[] }[] }>(
      '/global/hotels',
    );

    /*
     * Every hotel, not the first one that happens to have any.
     *
     * As written before, this looked at exactly one hotel — whichever the default order put
     * first — so `wi-fi` and `10-nomerov` were never inspected, and the character class here was
     * narrower than the slugs the seeds actually produce. Phase 7 changed which hotel came
     * first and the assertion failed on data that had been there since phase 2.
     */
    expect(body.items.some((hotel) => hotel.amenities.length > 0)).toBe(true);

    for (const hotel of body.items) {
      for (const amenity of hotel.amenities) {
        // A stable ASCII slug — decision D-40 — and never the translated label, which is what
        // `hotels.amenities JSON` would have forced.
        expect(amenity.code).toMatch(/^[a-z0-9][a-z0-9_-]*$/);
        expect(amenity.name.length).toBeGreaterThan(0);
      }
    }
  });

  it('lists the kinds of room a hotel has, priced or falling back to its own rate', async () => {
    /*
     * A hotel used to say one number and nothing else — «от 96 $ за ночь» — which is the only
     * figure a single price column can hold, and it said the same for the single room and the
     * duplex.
     *
     * `price: null` means «this hotel quotes one rate», not «this room is free», and the seeds
     * leave it null everywhere on purpose: what a duplex costs at a particular hotel is a
     * commercial fact nobody in this repository knows, and an invented one would look
     * researched. The operator fills them from the admin — that is what the feature is for.
     */
    const list = await get<{ items: { slug: string; category: string }[] }>('/global/hotels');
    const camp = list.items.find((hotel) => hotel.category === 'camp');
    const hotel = list.items.find((item) => item.category === 'hotel');
    expect(hotel, 'a seeded hotel to read rooms from').toBeDefined();

    const detail = await get<{
      priceFrom: { minor: number; currency: string };
      rooms: {
        code: string;
        name: string;
        capacity: number;
        sizeSqm: number | null;
        price: { minor: number } | null;
      }[];
    }>(`/global/hotels/${String(hotel?.slug)}`);

    expect(detail.rooms.length).toBeGreaterThan(0);
    for (const room of detail.rooms) {
      // A stable ASCII code and a translated name, the same rule the amenities follow (D-10).
      expect(room.code).toMatch(/^[a-z0-9][a-z0-9_]*$/);
      expect(room.name.length).toBeGreaterThan(0);
      expect(room.capacity).toBeGreaterThan(0);
      expect(room.price).toBeNull();
    }

    // The composition follows the category rather than being the same everywhere: a yurt camp
    // has yurts and no suite.
    if (camp !== undefined) {
      const campDetail = await get<{ rooms: { code: string }[] }>(`/global/hotels/${camp.slug}`);
      expect(campDetail.rooms.map((room) => room.code)).toContain('yurt');
      expect(campDetail.rooms.map((room) => room.code)).not.toContain('suite');
    }
  });

  it('never lets a room price reach a page in minor units', async () => {
    // The same rule every money value follows: the serializer is the schema, and the schema
    // says `{ minor, currency }` (D-12, D-24).
    const detail = await get<{ rooms: { price: unknown }[] }>('/global/hotels/yyldyz-hotel');
    for (const room of detail.rooms) {
      expect(room.price === null || typeof room.price === 'object').toBe(true);
    }
  });
});

describe('reviews', () => {
  it('computes the three numbers the design prints as literals', async () => {
    // 4,8 · 214 · 92% in the prototype, above nine rows that say otherwise. Decision D-6.
    const body = await get<{
      summary: { average: number; total: number; recommendPercent: number };
      items: { rating: number }[];
    }>('/global/reviews');

    expect(body.summary.total).toBe(9);
    expect(body.summary.average).toBeGreaterThan(0);
    expect(body.summary.average).toBeLessThanOrEqual(5);
    expect(body.summary.recommendPercent).toBeGreaterThanOrEqual(0);
    expect(body.summary.recommendPercent).toBeLessThanOrEqual(100);
  });

  it('actually sorts by date, which the prototype cannot', async () => {
    // «Сначала новые» sorts nothing there, because the date is the string «Май 2026».
    const newest = await get<{ items: { visitedOn: string | null }[] }>(
      '/global/reviews?sort=newest',
    );
    const dates = newest.items.map((review) => review.visitedOn ?? '');

    expect([...dates].sort().reverse()).toEqual(dates);

    const oldest = await get<{ items: { visitedOn: string | null }[] }>(
      '/global/reviews?sort=oldest',
    );
    expect(oldest.items[0]?.visitedOn).toBe(dates.at(-1));
  });
});

describe('the homepage, in one request', () => {
  it('brings every section the design draws', async () => {
    const body = await get<Record<string, unknown>>('/global/home');

    for (const section of [
      'slides',
      'featuredTours',
      'hotels',
      'articles',
      'gallery',
      'videos',
      'reviews',
      'reviewSummary',
      'facts',
      'visaSteps',
      'places',
      'faq',
      'slots',
      'stats',
    ]) {
      expect(body[section], `/global/home is missing ${section}`).toBeDefined();
    }
  });

  it('repeats seven of the eight country facts, which is the only difference', async () => {
    // One `is_featured` flag rather than a second table — decision D-17.
    const home = await get<{ facts: unknown[] }>('/global/home');
    const country = await get<{ facts: unknown[] }>('/global/country');

    expect(country.facts).toHaveLength(8);
    expect(home.facts).toHaveLength(7);
  });

  it('counts its own statistics', async () => {
    const home = await get<{ stats: { tours: number; hotels: number; reviews: number } }>(
      '/global/home',
    );
    const tours = await get<{ meta: { total: number } }>('/global/tours');

    expect(home.stats.tours).toBe(tours.meta.total);
    expect(home.stats.hotels).toBe(9);
    expect(home.stats.reviews).toBe(9);
  });

  it('names the slider from the slides, not from the places under it', async () => {
    /*
     * The defect the owner found, stated as a test.
     *
     * The hero used to be the first four rows of `places_to_see`: the caption was the place's
     * name, so «Дарваза» on the slider and «Кратер Дарваза» on `/turkmenistan` could not be
     * different words, and the order of the slides was the order of that page. The two lists
     * are separate in the design export and separate here; asserting they *differ* is what
     * makes a quiet return to the old arrangement visible.
     */
    const home = await get<{
      slides: { id: number; title: string; brief: string; media: unknown }[];
      places: { name: string }[];
    }>('/global/home');

    const titles = home.slides.map((slide) => slide.title);
    expect(titles).toEqual(['Дарваза', 'Йангыкала', 'Ашхабад', 'Мерв']);

    /*
     * And the places disagree with them on both counts, which is the whole finding.
     *
     * `places_to_see` runs Ашхабад, Кратер Дарваза, Древний Мерв, Куняургенч — a different order
     * under different names. The old hero printed the first four of *those* over the design's
     * four photographs, so the slider was captioned by a page nobody was looking at.
     */
    const places = home.places.slice(0, titles.length).map((place) => place.name);
    expect(places).not.toEqual(titles);
    expect(places[0]).toBe('Ашхабад');

    for (const slide of home.slides) {
      // One source for the picture, and one brief describing it while there is none (Q-1).
      expect(slide.brief.length, slide.title).toBeGreaterThan(0);
      expect(slide.media, slide.title).toBeNull();
    }
  });

  it('carries the photograph briefs, so every page renders without photographs', async () => {
    /*
     * Decision D-21 and question Q-1. There are no photographs at all; these rows are what let
     * `ImageSlot` draw a branded rectangle at the right proportions and turn the gap into a
     * checklist rather than an absence.
     */
    const body = await get<{
      slots: { slotKey: string; brief: string; media: unknown }[];
    }>('/global/home');

    expect(body.slots.length).toBeGreaterThan(0);
    for (const slot of body.slots) {
      expect(slot.brief.length, slot.slotKey).toBeGreaterThan(0);
      expect(slot.media, slot.slotKey).toBeNull();
    }
  });
});

describe('pagination', () => {
  it('reports totals rather than leaving «показано N из ?» to a literal', async () => {
    const body = await get<{
      items: unknown[];
      meta: { page: number; perPage: number; total: number; totalPages: number; hasMore: boolean };
    }>('/global/tours?page=1&perPage=4');

    expect(body.items).toHaveLength(4);
    expect(body.meta).toEqual({
      page: 1,
      perPage: 4,
      total: 10,
      totalPages: 3,
      hasMore: true,
    });
  });

  it('refuses a page size that would be a denial of service in a URL', async () => {
    const response = await context.app.inject({
      method: 'GET',
      url: `${API_PREFIX}/global/tours?perPage=100000`,
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('settings', () => {
  it('carries the operator´s own contacts, and no invented licence', async () => {
    /*
     * The inverse of the test that stood here, and inverted rather than deleted.
     *
     * It used to assert `TM-1428` and `unconfirmed: true` — question Q-12 made visible instead
     * of hidden behind plausible-looking data, which was right while nobody had asked the
     * owner. He answered on 2026-08-23: these are the numbers, and there is no licence to
     * print. So the assertion is now that the placeholder is gone, because a placeholder is
     * exactly the kind of thing that comes back in a later merge without anyone noticing.
     */
    const body = await get<{
      legal: { license: string | null; unconfirmed: boolean };
      contacts: { phone: string; email: string };
    }>('/global/settings');

    expect(body.legal.license).toBeNull();
    expect(body.legal.unconfirmed).toBe(false);
    expect(body.contacts.email).toBe('global@charva-travel.com');
    expect(body.contacts.phone).not.toContain('456 789');
  });

  it('gives the Umrah desk both of its lines', async () => {
    // Two numbers, and the second is not decoration: on the page where somebody is deciding to
    // hand over a passport, one line that does not answer is a reason to close the tab.
    const body = await get<{ contacts: { phone: string; phoneAlt: string; email: string } }>(
      '/umrah/settings',
    );

    expect(body.contacts.phone).toBe('+993 71 309 060');
    expect(body.contacts.phoneAlt).toBe('+993 71 309 070');
    expect(body.contacts.email).toBe('umra@charva-travel.com');
  });
});
