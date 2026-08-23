import { describe, expect, it } from 'vitest';

import { SITES, SITE_LANGS } from './constants';
import { contentMeta, hreflangSet, routeMeta, SITE_BRAND, SITE_ROUTES } from './seo';

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
});

describe('hreflang', () => {
  it('offers every language of the site plus x-default', () => {
    const global = hreflangSet('global');
    expect(global.map((entry) => entry.hreflang)).toEqual(['ru', 'en', 'tr', 'x-default']);

    // x-default is not a fourth language: it points at the one this site starts in.
    expect(global.at(-1)?.lang).toBe('ru');
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
      'tr',
      'tk',
      'x-default',
    ]);

    // The URL is unchanged: a path segment is an address, not a language tag.
    expect(hreflangSet('umrah')[0]?.lang).toBe('tm');
  });
});
