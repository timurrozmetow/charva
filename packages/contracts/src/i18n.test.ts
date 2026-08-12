import { describe, expect, it } from 'vitest';

import { isEmptyLocale, localizedText, pickLocale, translatedLangs } from './i18n';

describe('pickLocale', () => {
  const tour = { ru: 'Классика Туркменистана', en: 'Classic Turkmenistan' };

  it('returns the language asked for when it exists', () => {
    expect(pickLocale(tour, 'ru')).toBe('Классика Туркменистана');
    expect(pickLocale(tour, 'en')).toBe('Classic Turkmenistan');
  });

  it('walks the fallback chain for a language that has not been translated yet', () => {
    // Partial translation is the normal state for months, not an error — question Q-3.
    // A Turkish visitor gets English before Russian.
    expect(pickLocale(tour, 'tr')).toBe('Classic Turkmenistan');
  });

  it('sends a Turkmen reader to Russian, which is their second language', () => {
    expect(pickLocale({ ru: 'Умра', tm: '' }, 'tm')).toBe('Умра');
  });

  it('treats an empty string as missing', () => {
    // An editor clearing a field in the admin leaves `""` behind rather than deleting the key,
    // and a heading of `""` is a broken page.
    expect(pickLocale({ ru: 'Туры', en: '', tr: '   ' }, 'en')).toBe('Туры');
    expect(pickLocale({ ru: 'Туры', tr: '   ' }, 'tr')).toBe('Туры');
  });

  it('falls through to any language at all rather than rendering nothing', () => {
    // Wrong language is a translation bug; a blank line is a broken page.
    expect(pickLocale({ tm: 'Umra' }, 'en')).toBe('Umra');
  });

  it('returns an empty string only when there really is nothing', () => {
    expect(pickLocale({}, 'ru')).toBe('');
    expect(pickLocale(null, 'ru')).toBe('');
    expect(pickLocale(undefined, 'ru')).toBe('');
    expect(pickLocale({ ru: '', en: '' }, 'ru')).toBe('');
  });

  it('accepts an explicit chain, for a caller that knows better', () => {
    expect(pickLocale({ ru: 'Ру', en: 'En' }, 'tr', ['ru', 'en'])).toBe('Ру');
  });
});

describe('isEmptyLocale and translatedLangs', () => {
  it('reports what has actually been written', () => {
    // The admin's translation-completeness column, and the phase 8 report that decides which
    // languages the switcher is allowed to offer.
    expect(translatedLangs('global', { ru: 'Туры', en: 'Tours', tr: '' })).toEqual(['ru', 'en']);
    expect(translatedLangs('umrah', { tm: 'Umra', ru: 'Умра' })).toEqual(['tm', 'ru']);
    expect(translatedLangs('global', null)).toEqual([]);
  });

  it('ignores a language the site does not offer', () => {
    // A Turkish string on an Umrah row renders nowhere; counting it would overstate readiness.
    expect(translatedLangs('umrah', { tm: 'Umra', tr: 'Umre' })).toEqual(['tm']);
  });

  it('knows when a row has no readable copy in any language', () => {
    expect(isEmptyLocale({ ru: '', en: '' })).toBe(true);
    expect(isEmptyLocale({ tr: 'Türkmenistan' })).toBe(false);
  });
});

describe('localizedText', () => {
  it('requires the site default and leaves the rest optional', () => {
    const schema = localizedText('global');
    expect(schema.safeParse({ ru: 'Туры' }).success).toBe(true);
    expect(schema.safeParse({ en: 'Tours' }).success).toBe(false);
    expect(schema.safeParse({ ru: '' }).success).toBe(false);
  });

  it('defaults Umrah to Turkmen, not Russian', () => {
    const schema = localizedText('umrah');
    expect(schema.safeParse({ tm: 'Umra ziýarat' }).success).toBe(true);
    expect(schema.safeParse({ ru: 'Умра' }).success).toBe(false);
  });

  it('rejects a language the site does not offer', () => {
    // The whole point of a per-site tuple: a Turkish string cannot reach an Umrah row, where
    // nothing would ever render it.
    expect(localizedText('umrah').safeParse({ tm: 'Umra', tr: 'Umre' }).success).toBe(false);
    expect(localizedText('global').safeParse({ ru: 'Туры', tm: 'Turlar' }).success).toBe(false);
  });

  it('lets an optional field be blank in every language', () => {
    // A subtitle or a note, which most rows will not have.
    expect(localizedText('global', { optional: true }).safeParse({}).success).toBe(true);
  });

  it('caps the length, so a paste of a whole page cannot enter a column', () => {
    const schema = localizedText('global', { max: 10 });
    expect(schema.safeParse({ ru: 'Достаточно длинная строка' }).success).toBe(false);
  });
});
