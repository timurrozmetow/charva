import { describe, expect, it } from 'vitest';

import { bcp47, SITES, SITE_LANGS } from './constants';
import {
  contentMeta,
  hotelQualifier,
  hreflangSet,
  routeMeta,
  SITE_BRAND,
  SITE_ROUTES,
} from './seo';

/**
 * The head, checked for the things the type cannot say.
 *
 * The `satisfies` on `ROUTE_META` already guarantees that every route of every site has a title
 * in every language that site offers. What it cannot express is that those strings are any
 * good: that they name the brand, that they are short enough to survive a search result or a
 * Telegram card, and that nobody pasted the Russian one into the Turkish slot.
 */

describe('route meta', () => {
  it('names the brand in every title', () => {
    for (const site of SITES) {
      for (const route of SITE_ROUTES[site]) {
        for (const lang of SITE_LANGS[site]) {
          const meta = routeMeta(site, route, lang);
          expect(meta.title, `${site}/${route}/${lang}`).toContain(SITE_BRAND[site]);
        }
      }
    }
  });

  it('keeps descriptions short enough to be shown whole', () => {
    for (const site of SITES) {
      for (const route of SITE_ROUTES[site]) {
        for (const lang of SITE_LANGS[site]) {
          const { description } = routeMeta(site, route, lang);
          expect(
            description.length,
            `${site}/${route}/${lang} is ${String(description.length)}`,
          ).toBeLessThanOrEqual(200);
          expect(description.length).toBeGreaterThan(20);
        }
      }
    }
  });

  it('gives each language its own words', () => {
    // A copy-paste between language slots is the failure this catches: it type-checks, it
    // renders, and only a reader of that language ever notices.
    for (const site of SITES) {
      for (const route of SITE_ROUTES[site]) {
        const titles = SITE_LANGS[site].map((lang) => routeMeta(site, route, lang).title);
        expect(new Set(titles).size, `${site}/${route} repeats a title across languages`).toBe(
          titles.length,
        );
      }
    }
  });

  it('falls back to the site default for a language it does not speak', () => {
    // `?lang=tr` on Umrah is a routing bug, but the head still has to say something.
    expect(routeMeta('umrah', 'home', 'tr')).toEqual(routeMeta('umrah', 'home', 'tm'));
    expect(routeMeta('global', 'home', 'tm')).toEqual(routeMeta('global', 'home', 'ru'));
  });

  it('refuses a route it has no copy for', () => {
    // @ts-expect-error — the point of the test is the runtime guard behind the type.
    expect(() => routeMeta('global', 'nosuchroute', 'ru')).toThrow(/No head copy/);
  });
});

describe('content meta', () => {
  it('signs a detail page with the brand of its own site', () => {
    expect(contentMeta('umrah', { name: 'Uhud' }).title).toBe('Uhud — Charva Umrah');
    expect(contentMeta('global', { name: 'Мерв' }).title).toBe('Мерв — Charva Travel');
  });

  it('cuts a long summary at a length that still looks deliberate', () => {
    const long = 'а'.repeat(400);
    const { description } = contentMeta('global', { name: 'x', summary: long });

    expect(description).toHaveLength(158);
    expect(description.endsWith('…')).toBe(true);
  });

  it('leaves a short summary alone, and a missing one empty', () => {
    expect(contentMeta('global', { name: 'x', summary: 'Коротко.' }).description).toBe('Коротко.');
    expect(contentMeta('global', { name: 'x' }).description).toBe('');
    expect(contentMeta('global', { name: 'x', summary: null }).description).toBe('');
  });

  it('keeps the brand last, whatever else the title carries', () => {
    /*
     * `anchorText` builds the text of a link by stripping exactly « — Charva Travel» off the
     * end. A title that put the qualifier after the brand would leave the brand inside every
     * anchor on the fallback body — twenty links all ending in the same two words.
     */
    const { title } = contentMeta('global', { name: 'Мары Отель', qualifier: 'отель 3★, Мары' });

    expect(title).toBe('Мары Отель — отель 3★, Мары — Charva Travel');
    expect(title.endsWith(` — ${SITE_BRAND.global}`)).toBe(true);
  });
});

describe('what a hotel title says besides its name', () => {
  /*
   * Search Console indexed fewer than six in ten of Global's pages, and the hotels are the
   * thinnest of them. Nothing can be invented to fix that — the operator's own description is
   * one paragraph, and D-137 records why an amenity or a floor area must not be guessed at — but
   * the title was «Мары Отель — Charva Travel», which names neither what the page is nor where it
   * is. Somebody searching «гостиницы Мары» was offered a title with neither word in it.
   */
  it('names the kind, the rating and the city, from the columns that hold them', () => {
    expect(hotelQualifier('ru', { category: 'hotel', stars: 3, city: 'Мары' })).toBe(
      'отель 3★, Мары',
    );
    expect(hotelQualifier('en', { category: 'hotel', stars: 5, city: 'Ashgabat' })).toBe(
      'hotel 5★, Ashgabat',
    );
  });

  it('writes a comma where Russian would want a case ending', () => {
    /*
     * «в Ашхабаде», «в Дашогузе», «в Мары» — the locative differs per name, and inflecting one
     * from a string is the kind of guess that produces «в Мары Отель». A comma is correct in
     * every language this site speaks.
     */
    for (const city of ['Ашхабад', 'Дашогуз', 'Мары', 'Балкан']) {
      expect(hotelQualifier('ru', { category: 'hotel', stars: 4, city })).toBe(`отель 4★, ${city}`);
    }
  });

  it('leaves the stars out when there are none rather than printing an empty rating', () => {
    // A camp has no star rating, and «лагерь ★» would be a rating nobody gave it.
    expect(hotelQualifier('ru', { category: 'camp', stars: null, city: 'Каракумы' })).toBe(
      'лагерь, Каракумы',
    );
    expect(hotelQualifier('ru', { category: 'boutique', stars: 4, city: 'Ашхабад' })).toBe(
      'бутик-отель 4★, Ашхабад',
    );
  });

  it('falls back to the plain kind for a category it has no word for', () => {
    // The column is an enum, so this is a guard against the enum growing rather than a case that
    // exists — and a title reading «, Мары» would be worse than one reading «отель, Мары».
    expect(hotelQualifier('ru', { category: 'nosuchkind', stars: 3, city: 'Мары' })).toBe(
      'отель 3★, Мары',
    );
  });
});

describe('hreflang', () => {
  it('offers every language of the site plus x-default', () => {
    /*
     * Derived from `SITE_LANGS` rather than written out. The list used to be spelled
     * `['ru', 'en', 'tr', 'x-default']`, and when Turkish was retired (Q-17) that was a test
     * failing for naming the old answer rather than for anything being wrong — which teaches
     * whoever reads it next to edit the expectation, and an expectation that gets edited to
     * match is not one.
     *
     * What this is actually for is the two things the derivation cannot say: that every entry
     * is present, in order, and that `x-default` is appended once and points at the default.
     */
    for (const site of SITES) {
      const set = hreflangSet(site);
      const expected = [...SITE_LANGS[site].map(bcp47), 'x-default'];

      expect(
        set.map((entry) => entry.hreflang),
        site,
      ).toEqual(expected);
      // x-default is not an extra language: it points at the one this site starts in.
      expect(set.at(-1)?.lang, site).toBe(SITE_LANGS[site][0]);
    }

    expect(hreflangSet('global').at(-1)?.lang).toBe('ru');
    expect(hreflangSet('umrah').at(-1)?.lang).toBe('tm');
  });

  it('spells Turkmen the way a parser spells it', () => {
    // `tm` is the internal key and the country code; ISO 639-1 for Turkmen is `tk`. Lighthouse
    // called `hreflang="tm"` an invalid language code and discarded the whole alternate set
    // with it — on every page of two of the three sites.
    expect(hreflangSet('umrah').map((entry) => entry.hreflang)).toEqual(['tk', 'ru', 'x-default']);
    expect(hreflangSet('choice').map((entry) => entry.hreflang)).toEqual([
      'ru',
      'en',
      'tk',
      'x-default',
    ]);

    // The URL is unchanged: a path segment is an address, not a language tag.
    expect(hreflangSet('umrah')[0]?.lang).toBe('tm');
  });
});
