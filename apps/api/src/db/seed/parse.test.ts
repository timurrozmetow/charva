import { describe, expect, it } from 'vitest';

import {
  codeFromLabel,
  HOTEL_CATEGORIES,
  hotelFilterKey,
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
} from './parse';

/**
 * A mistake in any of these does not look like a bug. It looks like content — a tour that is
 * quietly six days long, a review dated to the wrong year, a price an order of magnitude out.
 * Hence the tests.
 */

describe('parseCount', () => {
  it('reads the number out of a rendered phrase', () => {
    expect(parseCount('8 дней')).toBe(8);
    expect(parseCount('5 городов')).toBe(5);
    expect(parseCount('10 gün')).toBe(10);
    expect(parseCount('44 adam')).toBe(44);
  });

  it('refuses a phrase with no number rather than guessing zero', () => {
    expect(() => parseCount('несколько дней')).toThrow();
  });
});

describe('parseStars', () => {
  it('accepts both notations the dataset uses for one fact', () => {
    // The cards spell it out, the filters write a digit, and both mean the same number.
    expect(parseStars('★★★★★')).toBe(5);
    expect(parseStars('★★★★☆')).toBe(4);
    expect(parseStars('4 ★')).toBe(4);
    expect(parseStars('5 ★')).toBe(5);
  });

  it('returns nothing for a category that has no stars', () => {
    // Which is the whole reason `stars` and `category` are separate columns.
    expect(parseStars('Бутик-отель')).toBeNull();
    expect(parseStars('Юрточный лагерь')).toBeNull();
  });
});

describe('parseMoney', () => {
  it('reads a price into whole minor units', () => {
    expect(parseMoney('1 190 $')).toEqual({ minor: 119_000, currency: 'USD' });
    expect(parseMoney('540 $')).toEqual({ minor: 54_000, currency: 'USD' });
    expect(parseMoney('145 $')).toEqual({ minor: 14_500, currency: 'USD' });
  });

  it('reads a non-breaking thousands separator, which looks identical', () => {
    expect(parseMoney('1 190 $').minor).toBe(119_000);
    expect(parseMoney('8 575 TMT')).toEqual({ minor: 857_500, currency: 'TMT' });
  });

  it('keeps the cents when there are any', () => {
    expect(parseMoney('12,50 $').minor).toBe(1_250);
    expect(parseMoney('12.5 $').minor).toBe(1_250);
  });

  it('refuses a string with no number in it', () => {
    expect(() => parseMoney('по запросу')).toThrow();
  });
});

describe('parseSpan', () => {
  it('reads the mosaic hint the design writes as CSS', () => {
    expect(parseSpan('span 2')).toBe(2);
    expect(parseSpan('1')).toBe(1);
    expect(parseSpan(undefined)).toBe(1);
  });
});

describe('dates', () => {
  it('turns a month and year into something that sorts', () => {
    // «Май 2026» as a string is precisely why the prototype's "newest first" filter does
    // nothing at all.
    expect(parseMonthYear('Май 2026')).toBe('2026-05-01');
    expect(parseMonthYear('Апрель 2025')).toBe('2025-04-01');
    expect(parseMonthYear('Декабрь 2025')).toBe('2025-12-01');
  });

  it('reads the Turkmen group dates', () => {
    expect(parseDmy('12.06.2026')).toBe('2026-06-12');
    expect(parseDmy('03.11.2025')).toBe('2025-11-03');
  });

  it('refuses a month name it does not know', () => {
    expect(() => parseMonthYear('Brumaire 2026')).toThrow();
  });
});

describe('parseDuration and parseViews', () => {
  it('turns a clock into seconds', () => {
    // A VARCHAR of `14:20` cannot be sorted, summed, or written differently in another locale.
    expect(parseDuration('6:12')).toBe(372);
    expect(parseDuration('14:20')).toBe(860);
    expect(parseDuration('1:02:03')).toBe(3_723);
  });

  it('reads a view count out of its sentence', () => {
    expect(parseViews('11 800 просмотров')).toBe(11_800);
    expect(parseViews('26 400 просмотров')).toBe(26_400);
  });
});

describe('slugify', () => {
  it('transliterates Russian', () => {
    expect(slugify('Классический Туркменистан')).toBe('klassicheskiy-turkmenistan');
    expect(slugify('Кратер Дарваза, Каракумы')).toBe('krater-darvaza-karakumy');
  });

  it('transliterates Turkmen, including the letters the font is missing', () => {
    expect(slugify('Ýyldyz Hotel')).toBe('yyldyz-hotel');
    expect(slugify('Aşgabat')).toBe('ashgabat');
    expect(slugify('Iýun aýyndaky toparymyz')).toBe('iyun-ayyndaky-toparymyz');
  });

  it('produces something that can live in a URL', () => {
    // Slugs end up in every shared link, so they are ASCII and they never change.
    for (const source of ['Мары / Мерв', 'Masjid al-Haram', 'Аваза — Каспий', '  ']) {
      expect(slugify(source)).toMatch(/^[a-z0-9-]*$/);
    }
    expect(slugify('Мары / Мерв')).toBe('mary-merv');
  });
});

describe('codes', () => {
  it('maps a label to a stable code', () => {
    // Translating «Классика» into «Klasik» must not change which tours a filter matches.
    expect(codeFromLabel('Классика', TOUR_CATEGORIES)).toBe('classic');
    expect(codeFromLabel(' Природа ', TOUR_CATEGORIES)).toBe('nature');
  });

  it('refuses a label nobody has mapped', () => {
    // Better a seed that stops than a catalogue with a category no filter can reach.
    expect(() => codeFromLabel('Гастрономия', TOUR_CATEGORIES)).toThrow();
  });

  it('accepts every spelling the design uses for a category', () => {
    // «Бутик» on the filter chip, «Бутик-отель» in the builder; «Кемп» against «Юрточный
    // лагерь». Four labels, two categories — and the CHECK constraint caught the one that was
    // missing, by refusing a starless hotel.
    for (const label of ['Бутик', 'Бутик-отель']) {
      expect(HOTEL_CATEGORIES[label]).toBe('boutique');
    }
    for (const label of ['Кемп', 'Юрточный лагерь']) {
      expect(HOTEL_CATEGORIES[label]).toBe('camp');
    }
  });

  it('derives the hotel filter key rather than storing it twice', () => {
    expect(hotelFilterKey('hotel', 5)).toBe('5star');
    expect(hotelFilterKey('camp', null)).toBe('camp');
    expect(hotelFilterKey('boutique', null)).toBe('boutique');
  });
});
