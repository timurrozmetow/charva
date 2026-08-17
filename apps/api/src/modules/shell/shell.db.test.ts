import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestApp, type TestApp } from '../../test/app';

import { escapeHtml, escapeJsonLd, type HeadTag, injectHead, renderHead } from './html';
import { resolveRoute } from './routes-map';
import { renderShellHead } from './service';
import { collectEntries, renderRobots, renderSitemap } from './sitemap';

/**
 * The head a crawler and a Telegram card receive.
 *
 * These assertions are what stands in for a response schema on `/shell`: the route answers with
 * HTML, so there is no object for the serialiser to constrain, and the guarantee has to be made
 * where the shape does exist — on the `HeadTag[]` the head is built from.
 *
 * Everything here is against the seeded database, because the interesting cases are about real
 * rows: a tour's own title, a departure that exists, a slug that does not.
 */

let context: TestApp;

beforeAll(async () => {
  context = await buildTestApp();
}, 60_000);

afterAll(async () => {
  await context.close();
});

const ORIGIN = 'https://global.charva-travel.com';

function head(tags: HeadTag[]) {
  return {
    title: tags.find((tag) => tag.tag === 'title')?.text ?? '',
    meta: (name: string) =>
      tags.find((tag) => tag.tag === 'meta' && tag.attributes?.['name'] === name)?.attributes?.[
        'content'
      ],
    og: (property: string) =>
      tags.find((tag) => tag.tag === 'meta' && tag.attributes?.['property'] === property)
        ?.attributes?.['content'],
    links: (rel: string) =>
      tags.filter((tag) => tag.tag === 'link' && tag.attributes?.['rel'] === rel),
    jsonLd: tags
      .filter((tag) => tag.tag === 'script')
      .map((tag) => JSON.parse(tag.text ?? '{}') as Record<string, unknown>),
  };
}

function render(site: 'choice' | 'global' | 'umrah', path: string) {
  return renderShellHead({
    db: context.app.db,
    site,
    path,
    origin: site === 'umrah' ? 'https://umra.charva-travel.com' : ORIGIN,
    mediaBaseUrl: '',
  });
}

describe('matching a path to a page', () => {
  it('reads the language prefix and the section', () => {
    expect(resolveRoute('global', '/ru/tours')).toMatchObject({ lang: 'ru', route: 'tours' });
    expect(resolveRoute('global', '/en/hotels/garagum-camp')).toMatchObject({
      lang: 'en',
      route: 'hotels',
      slug: 'garagum-camp',
    });
    expect(resolveRoute('umrah', '/ru/ziyarat')).toMatchObject({ lang: 'ru', route: 'ziyarat' });
  });

  it('falls back to the site default when the path carries no language', () => {
    // A crawler may well hold the bare `/`, which every SPA redirects from.
    expect(resolveRoute('global', '/')).toMatchObject({ lang: 'ru', route: 'home' });
    expect(resolveRoute('umrah', '/')).toMatchObject({ lang: 'tm', route: 'home' });
  });

  it('does not mistake a language this site does not speak for a prefix', () => {
    // `tm` is not an Umrah-only accident: Global has no Turkmen, so `/tm/tours` is a path
    // segment, not a language, and the page is a 404 rather than a Turkmen tour list.
    expect(resolveRoute('global', '/tm/tours')).toMatchObject({ lang: 'ru', route: 'notFound' });
  });

  it('treats a trailing slash as the same page', () => {
    expect(resolveRoute('global', '/ru/tours/').pathAfterLang).toBe('/tours');
    expect(resolveRoute('global', '/ru/').pathAfterLang).toBe('');
  });

  it('sends an unknown path on the chooser to the chooser', () => {
    // It has one page and its router redirects everything to it; there is no missing page.
    expect(resolveRoute('choice', '/ru/nonsense').route).toBe('home');
  });
});

describe('a list page', () => {
  it('carries the title, the canonical and the full hreflang set', async () => {
    const { tags } = await render('global', '/ru/tours');
    const page = head(tags);

    expect(page.title).toBe('Готовые туры по Туркменистану — Charva Travel');
    expect(page.meta('description')).toContain('Маршруты по Туркменистану');

    expect(page.links('canonical')[0]?.attributes?.['href']).toBe(`${ORIGIN}/ru/tours`);

    const alternates = page.links('alternate').map((link) => link.attributes?.['hreflang']);
    expect(alternates).toEqual(['ru', 'en', 'tr', 'x-default']);

    // x-default is not a fourth language: it points at the one this site starts in.
    const xDefault = page.links('alternate').at(-1)?.attributes?.['href'];
    expect(xDefault).toBe(`${ORIGIN}/ru/tours`);
  });

  it('names the agency on every page, with the contacts from settings', async () => {
    const { tags } = await render('global', '/ru/tours');
    const agency = head(tags).jsonLd[0];

    expect(agency?.['@type']).toBe('TravelAgency');
    expect(agency?.['name']).toBe('Charva Travel');
    expect(agency?.['telephone']).toBeDefined();
  });

  it('counts the reviews rather than claiming a number', async () => {
    const { tags } = await render('global', '/ru/reviews');
    const rating = head(tags).jsonLd.find((entry) => entry['aggregateRating'] !== undefined);

    const aggregate = rating?.['aggregateRating'] as Record<string, unknown> | undefined;
    expect(Number(aggregate?.['reviewCount'])).toBeGreaterThan(0);
    // «4.8 from 214 reviews» is the prototype's invention; this is the number of rows.
    expect(Number(aggregate?.['ratingValue'])).toBeLessThanOrEqual(5);
  });

  it('turns the FAQ into structured questions', async () => {
    const { tags } = await render('global', '/ru/contact');
    const faq = head(tags).jsonLd.find((entry) => entry['@type'] === 'FAQPage');

    expect(Array.isArray(faq?.['mainEntity'])).toBe(true);
    expect((faq?.['mainEntity'] as unknown[]).length).toBeGreaterThan(0);
  });
});

describe('a detail page', () => {
  it('takes its head from the row', async () => {
    const { tags, found } = await render('global', '/ru/tours/klassicheskiy-turkmenistan');
    const page = head(tags);

    expect(found).toBe(true);
    expect(page.title).toMatch(/ — Charva Travel$/);
    expect(page.title).not.toBe('Готовые туры по Туркменистану — Charva Travel');
    expect(page.og('og:url')).toBe(`${ORIGIN}/ru/tours/klassicheskiy-turkmenistan`);

    const trip = page.jsonLd.find((entry) => entry['@type'] === 'TouristTrip');
    expect(trip?.['name']).toBe(page.title.replace(' — Charva Travel', ''));
    // A tour is the one thing in this project that has a price and should advertise it.
    expect((trip?.['offers'] as Record<string, unknown>)['priceCurrency']).toBe('USD');
  });

  it('reports a slug that names no row as not found', async () => {
    const { found, tags } = await render('global', '/ru/tours/no-such-tour');

    expect(found).toBe(false);
    // Still a head: a 404 that a crawler reads should say what it is.
    expect(head(tags).title).toBe('Страница не найдена — Charva Travel');
  });

  it('describes a place of ziyarat as an attraction', async () => {
    const slug = context.discoveredSlugs.get('/api/v1/umrah/ziyarat/:slug');
    expect(slug).toBeDefined();

    const { tags } = await render('umrah', `/tm/ziyarat/${slug!}`);
    const attraction = head(tags).jsonLd.find((entry) => entry['@type'] === 'TouristAttraction');

    expect(attraction?.['name']).toBeDefined();
    expect(head(tags).title).toMatch(/ — Charva Umrah$/);
  });
});

describe('the Umrah head', () => {
  it('publishes the departure as an event with no price on it', async () => {
    const { tags } = await render('umrah', '/tm');
    const event = head(tags).jsonLd.find((entry) => entry['@type'] === 'Event');

    expect(event).toBeDefined();
    expect(event?.['startDate']).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    /*
     * `Event` has an `offers` field, search engines reward filling it, and the price is sitting
     * in the same row. The ban is on anything reaching a browser, and a `<script>` block is
     * read by a browser.
     */
    expect(JSON.stringify(event)).not.toMatch(/price|offers|TMT|manat/i);
  });

  it('leaks no price anywhere in the head of any Umrah page', async () => {
    for (const path of ['/tm', '/tm/paket', '/tm/maksatnama', '/ru/yazylmak']) {
      const { tags } = await render('umrah', path);
      const serialised = JSON.stringify(tags);

      expect(serialised, `${path} leaked something money-shaped`).not.toMatch(
        /\bprice|\bcost|857500|8\s?575|TMT|manat/i,
      );
    }
  });
});

describe('escaping', () => {
  it('neutralises markup in a title an editor typed', () => {
    expect(escapeHtml('Тур «5<script>» & сыn')).toBe('Тур «5&lt;script&gt;» &amp; сыn');
  });

  it('stops a summary from closing the JSON-LD block early', () => {
    // The whole attack: a row whose text contains `</script>` followed by anything at all.
    const escaped = escapeJsonLd({ name: '</script><img src=x onerror=alert(1)>' });

    expect(escaped).not.toContain('</script>');
    expect(escaped).toContain('\\u003c');
    // Still JSON, which HTML escaping would have destroyed.
    expect(JSON.parse(escaped)).toEqual({ name: '</script><img src=x onerror=alert(1)>' });
  });
});

describe('injecting into the built page', () => {
  const template =
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<title>Charva</title><meta name="description" content="old">' +
    '<script type="module" src="/assets/index-abc123.js"></script>' +
    '</head><body><div id="root"></div></body></html>';

  it('replaces the template head and keeps the hashed bundle', () => {
    const html = injectHead(
      template,
      renderHead([
        { tag: 'title', text: 'Новый заголовок' },
        { tag: 'meta', attributes: { name: 'description', content: 'новое описание' } },
      ]),
    );

    expect(html).toContain('index-abc123.js');
    expect(html).toContain('<title>Новый заголовок</title>');

    // Two titles means whichever one the reader's parser prefers, and Telegram and Google do
    // not agree on which that is.
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html).not.toContain('content="old"');
  });

  it('refuses a template it cannot render into', () => {
    expect(() => injectHead('<html><body>no head</body></html>', '')).toThrow(/no <\/head>/i);
  });
});

describe('the sitemap', () => {
  it('lists every published page in every language the site speaks', async () => {
    const entries = await collectEntries(context.app.db, 'global');
    const xml = renderSitemap('global', ORIGIN, entries);

    const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

    // Three languages × every entry, and nothing outside this origin.
    expect(locations).toHaveLength(entries.length * 3);
    expect(locations.every((url) => url?.startsWith(ORIGIN))).toBe(true);

    expect(locations).toContain(`${ORIGIN}/ru/tours`);
    expect(locations).toContain(`${ORIGIN}/en/tours`);
    expect(locations).toContain(`${ORIGIN}/tr/tours`);
    expect(locations).toContain(`${ORIGIN}/ru/tours/klassicheskiy-turkmenistan`);
  });

  it('gives each URL the whole alternate set, itself included', () => {
    const xml = renderSitemap('umrah', 'https://umra.charva-travel.com', [
      { pathAfterLang: '/paket', lastModified: null, changeFrequency: 'monthly', priority: '0.9' },
    ]);

    // Two languages plus x-default, on each of the two entries: a set where one page names
    // another without being named back is treated as unconfirmed and ignored.
    expect(xml.match(/xhtml:link/g)).toHaveLength(6);
    expect(xml).toContain('hreflang="x-default"');
    expect(xml).toContain('href="https://umra.charva-travel.com/tm/paket"');
  });

  it('lists no unpublished row', async () => {
    const [rows] = await context.pool.query(
      'SELECT slug FROM tours WHERE is_published = 0 LIMIT 1',
    );
    const hidden = (rows as { slug: string }[])[0]?.slug;

    const xml = renderSitemap('global', ORIGIN, await collectEntries(context.app.db, 'global'));
    if (hidden !== undefined) expect(xml).not.toContain(hidden);

    // And the check is not vacuous: a published one is definitely there.
    expect(xml).toContain('klassicheskiy-turkmenistan');
  });

  it('is well-formed enough to parse as XML', async () => {
    const xml = renderSitemap('global', ORIGIN, await collectEntries(context.app.db, 'global'));

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml.match(/<url>/g)?.length).toBe(xml.match(/<\/url>/g)?.length);
    // No raw ampersand anywhere: a slug with one would break the whole document.
    expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|#39;)/);
  });
});

describe('robots.txt', () => {
  it('closes the admin and the API completely', () => {
    for (const host of ['admin', 'api'] as const) {
      const robots = renderRobots(host, `https://${host}.charva-travel.com`);
      expect(robots).toContain('Disallow: /');
      expect(robots).not.toContain('Sitemap:');
      expect(robots).not.toContain('Allow: /');
    }
  });

  it('opens the public sites and points at their own sitemap', () => {
    const robots = renderRobots('global', ORIGIN);
    expect(robots).toContain('Allow: /');
    expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
    // The photographs stay crawlable — image search is worth having for a tour operator —
    // but the resizer is not a page.
    expect(robots).toContain('Disallow: /img/');
    expect(robots).not.toContain('Disallow: /uploads');
  });
});
