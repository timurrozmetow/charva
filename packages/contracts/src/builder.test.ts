import { describe, expect, it } from 'vitest';

import { type BuilderConfig, type BuilderOption, DEFAULT_PRICING_RULES, quote } from './builder';
import { formatMoney } from './money';

/** Thousands are separated by a non-breaking space; written as an escape so a diff shows it. */
const NBSP = '\u00A0';

/**
 * The option table as the seeds will create it, with the designer's rates in minor units.
 *
 * The codes are ASCII and stable, and the display strings they replace — `3 ★`, `3–5`,
 * `7 дней` — are nowhere near the price. That is decision D-10: the prototype keys its rate
 * table by strings containing a real star character and an en-dash, so translating the label
 * «3–5» silently reprices the tour.
 */
const OPTIONS: BuilderOption[] = [
  ...['ashgabat', 'darvaza', 'merv', 'konye_urgench', 'yangykala', 'awaza'].map((city) => ({
    code: `dest_${city}`,
    step: 'dest' as const,
    numericValue: null,
    priceModifierMinor: null,
    modifierType: 'per_item' as const,
  })),
  ...[3, 5, 7, 10, 14].map((nights) => ({
    code: `nights_${String(nights)}`,
    step: 'dates' as const,
    numericValue: nights,
    priceModifierMinor: null,
    modifierType: 'none' as const,
  })),
  {
    code: 'nights_custom',
    step: 'dates',
    numericValue: null,
    priceModifierMinor: null,
    modifierType: 'none',
  },
  ...[
    ['hotel_3star', 4_600],
    ['hotel_4star', 7_800],
    ['hotel_5star', 14_500],
    ['hotel_boutique', 9_600],
    ['hotel_yurt', 9_500],
    ['hotel_mixed', 8_800],
  ].map(([code, rate]) => ({
    code: String(code),
    step: 'hotel' as const,
    numericValue: null,
    priceModifierMinor: Number(rate),
    modifierType: 'per_night' as const,
  })),
  ...['city_tour', 'desert_camp', 'horses', 'food_tour', 'crafts', 'caspian'].map((act) => ({
    code: `act_${act}`,
    step: 'activities' as const,
    numericValue: null,
    priceModifierMinor: null,
    modifierType: 'per_item' as const,
  })),
  ...[
    ['pax_1', 1],
    ['pax_2', 2],
    ['pax_3_5', 4],
    ['pax_6_10', 8],
    ['pax_10_plus', 12],
  ].map(([code, value]) => ({
    code: String(code),
    step: 'people' as const,
    numericValue: Number(value),
    priceModifierMinor: null,
    modifierType: 'none' as const,
  })),
  {
    code: 'pax_unknown',
    step: 'people',
    numericValue: null,
    priceModifierMinor: null,
    modifierType: 'none',
  },
];

const CONFIG: BuilderConfig = { options: OPTIONS, rules: DEFAULT_PRICING_RULES };

describe('quote', () => {
  it('prices an untouched builder at 1 296 $', () => {
    // The number every visitor sees before their first click, and the acceptance criterion for
    // this phase. Six nights at the four-star rate plus the base fee, for two people:
    // 6 × 78 + 180 = 648, doubled.
    const result = quote({}, CONFIG);

    expect(result.perPerson.minor).toBe(64_800);
    expect(result.total.minor).toBe(129_600);
    expect(formatMoney(result.total)).toBe(`1${NBSP}296${NBSP}$`);
  });

  it('says so while it is still guessing', () => {
    const result = quote({}, CONFIG);
    expect(result.isEstimate).toBe(true);
    expect(result.missingSteps).toEqual(['dest', 'dates', 'hotel', 'activities', 'people']);
  });

  it('stops guessing once every priced step is answered', () => {
    const result = quote(
      {
        dest: ['dest_ashgabat'],
        dates: 'nights_7',
        hotel: 'hotel_4star',
        activities: ['act_city_tour'],
        people: 'pax_2',
      },
      CONFIG,
    );

    expect(result.isEstimate).toBe(false);
    expect(result.missingSteps).toEqual([]);
  });

  it('reads nights as a count and the hotel as a rate', () => {
    // README §7 puts both in one `price_modifier` column, where `7 дней` becomes a price of
    // seven. Two columns, two meanings — D-10.
    const result = quote({ dates: 'nights_10', hotel: 'hotel_5star', people: 'pax_1' }, CONFIG);

    expect(result.nights).toBe(10);
    expect(result.pax).toBe(1);
    // 10 × 145 + 180
    expect(result.perPerson.minor).toBe(10 * 14_500 + 18_000);
    expect(result.total.minor).toBe(result.perPerson.minor);
  });

  it('charges per city and per activity', () => {
    const result = quote(
      {
        dest: ['dest_ashgabat', 'dest_darvaza', 'dest_merv'],
        activities: ['act_city_tour', 'act_horses'],
        people: 'pax_1',
      },
      CONFIG,
    );

    // 6 × 78 + 3 × 60 + 2 × 45 + 180
    expect(result.perPerson.minor).toBe(6 * 7_800 + 3 * 6_000 + 2 * 4_500 + 18_000);
  });

  it('multiplies by the group size the option means, not by its label', () => {
    // «6–10» prices as eight and «10+» as twelve — the numbers the prototype hardcodes and
    // question Q-10 asks the owner to confirm.
    expect(quote({ people: 'pax_6_10' }, CONFIG).pax).toBe(8);
    expect(quote({ people: 'pax_10_plus' }, CONFIG).pax).toBe(12);
  });

  it('falls back to the defaults for an option that carries no number', () => {
    // «Свои даты» and «Пока не знаю» are real answers, and both mean "the manager will ask".
    const result = quote({ dates: 'nights_custom', people: 'pax_unknown' }, CONFIG);
    expect(result.nights).toBe(DEFAULT_PRICING_RULES.defaultNights);
    expect(result.pax).toBe(DEFAULT_PRICING_RULES.defaultPax);
  });

  it('ignores a code that no longer exists', () => {
    // An option deleted in the admin while a visitor had it selected, or a stale URL. The
    // quote must degrade to the default rather than throw on a public endpoint.
    const result = quote({ hotel: 'hotel_deleted', dates: 'nights_removed' }, CONFIG);
    expect(result.perPerson.minor).toBe(64_800);
  });

  it('breaks the total down into lines that add up', () => {
    const result = quote(
      { dest: ['dest_ashgabat', 'dest_awaza'], dates: 'nights_5', hotel: 'hotel_yurt' },
      CONFIG,
    );

    const sum = result.breakdown.reduce((total, line) => total + line.amountMinor, 0);
    expect(sum).toBe(result.perPerson.minor);
    expect(result.breakdown.map((line) => line.kind)).toEqual([
      'accommodation',
      'cities',
      'activities',
      'base',
    ]);
  });

  it('is byte-identical across repeated calls', () => {
    // The client runs this on every click and the server runs it again on submit; integer
    // arithmetic is what stops the two disagreeing in the last cent.
    const selection = {
      dest: ['dest_darvaza', 'dest_yangykala'],
      dates: 'nights_14',
      hotel: 'hotel_mixed',
      activities: ['act_desert_camp', 'act_crafts', 'act_caspian'],
      people: 'pax_3_5',
    };

    const first = JSON.stringify(quote(selection, CONFIG));
    for (let run = 0; run < 20; run += 1) {
      expect(JSON.stringify(quote(selection, CONFIG))).toBe(first);
    }
  });

  it('matches the prototype on twenty random selections', () => {
    // A property test against the arithmetic the design actually shipped, in major units:
    // `nights * hotelRate + dests * 60 + acts * 45 + 180`, times `pax`.
    const rates: Record<string, number> = {
      hotel_3star: 46,
      hotel_4star: 78,
      hotel_5star: 145,
      hotel_boutique: 96,
      hotel_yurt: 95,
      hotel_mixed: 88,
    };
    const nightsBy: Record<string, number> = {
      nights_3: 3,
      nights_5: 5,
      nights_7: 7,
      nights_10: 10,
      nights_14: 14,
    };
    const paxBy: Record<string, number> = {
      pax_1: 1,
      pax_2: 2,
      pax_3_5: 4,
      pax_6_10: 8,
      pax_10_plus: 12,
    };
    const cities = ['dest_ashgabat', 'dest_darvaza', 'dest_merv', 'dest_konye_urgench'];
    const acts = ['act_city_tour', 'act_desert_camp', 'act_horses', 'act_crafts'];

    // A fixed sequence rather than Math.random: a property test that fails only sometimes is
    // a property test nobody trusts.
    let seed = 20260812;
    const next = (bound: number): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % bound;
    };

    for (let run = 0; run < 20; run += 1) {
      const hotel = Object.keys(rates)[next(6)] ?? 'hotel_4star';
      const dates = Object.keys(nightsBy)[next(5)] ?? 'nights_7';
      const people = Object.keys(paxBy)[next(5)] ?? 'pax_2';
      const dest = cities.slice(0, next(cities.length + 1));
      const activities = acts.slice(0, next(acts.length + 1));

      const expected =
        ((nightsBy[dates] ?? 6) * (rates[hotel] ?? 78) +
          dest.length * 60 +
          activities.length * 45 +
          180) *
        (paxBy[people] ?? 2);

      const result = quote({ hotel, dates, people, dest, activities }, CONFIG);
      expect(result.total.minor, `${hotel} / ${dates} / ${people}`).toBe(expected * 100);
    }
  });
});
