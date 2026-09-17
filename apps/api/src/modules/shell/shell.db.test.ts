import { bcp47, SCRIM_RGB, SITE_LANGS } from '@charva/contracts';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { API_PREFIX } from '../../app';
import * as t from '../../db/schema';
import { buildTestApp, type TestApp } from '../../test/app';

import {
  escapeHtml,
  escapeJsonLd,
  type HeadTag,
  injectBody,
  injectBootImage,
  injectHead,
  renderHead,
} from './html';
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
    // `type` checked, not just the tag: the head also carries counter snippets, which are
    // JavaScript and would throw here the moment a test configures one.
    jsonLd: tags
      .filter((tag) => tag.tag === 'script' && tag.attributes?.['type'] === 'application/ld+json')
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
    expect(resolveRoute('choice', '/ru/nonsense').matched).toBe(false);
  });

  it('answers 200 for the chooser itself, in every language it speaks', async () => {
    // The chooser's fallback route IS `home`, its only page, so deriving "found" by comparing
    // the route id against the fallback made every chooser URL a 404 — the homepage included.
    // Browsers render a 404 body perfectly well, so the only readers who ever saw it were the
    // two this whole shell exists for: the crawler and the Telegram card.
    for (const path of ['/', ...SITE_LANGS.choice.map((lang) => `/${lang}`)]) {
      const { found } = await render('choice', path);
      expect(found, `chooser ${path}`).toBe(true);
    }
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
    expect(alternates).toEqual([...SITE_LANGS.global.map(bcp47), 'x-default']);

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

  it('still publishes it when no departure is pinned, because pinning is the exception', async () => {
    /*
     * This block selected `is_current = true` by itself while everything else on the site
     * derived the current departure from the dates (D-13). The two agreed only because the seed
     * happens to set the flag — and in the live database it had been left on a group that was
     * about to fly, which is precisely the state D-13 says a flag ends up in. Clearing it took
     * the event off the page and nothing looked different, because nobody sees structured data.
     */
    await context.app.db.update(t.umrahTrips).set({ isCurrent: false });

    const { tags } = await render('umrah', '/tm');
    const event = head(tags).jsonLd.find((entry) => entry['@type'] === 'Event');

    expect(event).toBeDefined();
    expect(event?.['startDate']).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    await context.app.db
      .update(t.umrahTrips)
      .set({ isCurrent: true })
      .where(eq(t.umrahTrips.id, 1));
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

  it('does not let a comment mentioning the title tag swallow what follows it', () => {
    /*
     * This shipped. The strip for the template's own title spans lines, because it matches a
     * pair of tags with text between them — so an opening tag inside a comment matched, and the
     * match ran from there to the real closing tag, taking everything between with it.
     *
     * The chooser went live with the Google verification tag gone from the response while it sat
     * in the file on disk, and the comment above it cut off in the middle of a word. Nothing
     * failed: the result was valid HTML that was simply missing a line.
     */
    const withComment =
      '<!doctype html><html><head><meta charset="utf-8">' +
      '<!-- the shell strips the <title> and the description before injecting -->' +
      '<meta name="google-site-verification" content="token">' +
      '<title>Charva</title>' +
      '</head><body></body></html>';

    const html = injectHead(withComment, renderHead([{ tag: 'title', text: 'Новый' }]));

    expect(html).toContain('name="google-site-verification"');
    expect(html).toContain('before injecting -->');

    // The template's own title still goes, and exactly one element is left — counted with the
    // comments taken out, because the comment says `<title>` too and is supposed to survive
    // saying it. Counting the raw string here is what the shell itself was doing wrong.
    const markup = html.replace(/<!--[\s\S]*?-->/g, '');
    expect(markup).not.toContain('<title>Charva</title>');
    expect(markup.match(/<title>/g)).toHaveLength(1);
  });

  it('puts every comment back exactly as it was', () => {
    // The masking is only safe if the restore is total: a placeholder left in the output would
    // be visible in the page source, and a comment dropped would be this bug again.
    const commented =
      '<!doctype html><html><head><!-- one --><meta charset="utf-8"><!-- two -->' +
      '<title>Charva</title><!-- three --></head><body><!-- four --></body></html>';

    const html = injectHead(commented, '');

    for (const text of ['<!-- one -->', '<!-- two -->', '<!-- three -->', '<!-- four -->']) {
      expect(html).toContain(text);
    }
    expect(html).not.toContain('@@charva-comment');
  });
});

describe('the picture a shared link shows', () => {
  /*
   * The seed ships no photographs at all — D-45, and rightly, since there were none to ship.
   * So the fixture is one media row hung on the two places this feature reads from: the first
   * hero slide, which is what a page with nothing of its own falls back to, and a tour cover,
   * which is a page that has something of its own.
   */
  let mediaId = 0;

  beforeAll(async () => {
    const [inserted] = await context.app.db.insert(t.media).values({
      storageKey: '2026/09/shell-test-fixture.webp',
      mime: 'image/webp',
      width: 2400,
      height: 1600,
      sizeBytes: 900_000,
      checksum: 'shelltestfixture'.padEnd(64, '0'),
      alt: { ru: 'Пустыня на рассвете', en: 'The desert at dawn' },
      // The splash paints this while the full file is still arriving, so the fixture has to
      // carry one or the branch that matters most on a dense screen goes untested.
      lqip: 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4IA4AAAAwAQCdASoBAAEAAgA0JaQAA3AA/vuUAAA=',
    });
    mediaId = inserted.insertId;

    await context.app.db.update(t.heroSlides).set({ mediaId });
    await context.app.db.update(t.tours).set({ coverMediaId: mediaId });
    // The chooser's two halves, which the head now starts early. Without a photograph on them
    // the assertion below would pass against a page that simply has nothing to preload.
    await context.app.db
      .update(t.contentSlots)
      .set({ mediaId })
      .where(inArray(t.contentSlots.slotKey, ['choice-global', 'choice-umrah']));
  });

  afterAll(async () => {
    await context.app.db.update(t.tours).set({ coverMediaId: null });
    await context.app.db.update(t.heroSlides).set({ mediaId: null });
    await context.app.db
      .update(t.contentSlots)
      .set({ mediaId: null })
      .where(inArray(t.contentSlots.slotKey, ['choice-global', 'choice-umrah']));
    await context.app.db.delete(t.media).where(eq(t.media.id, mediaId));
  });

  it('gives one to every page, not only the four built from a row', async () => {
    /*
     * These links travel in Telegram — that is the whole reason the shell exists (D-4) — and
     * until now only a tour, a hotel, an article and a place put a photograph in their card.
     * Every other page, the two homepages and every section among them, unfurled as a line of
     * grey text. A page with nothing of its own shows its section's first photograph, and
     * failing that the site's first hero slide.
     */
    for (const path of ['/ru', '/ru/tours', '/ru/hotels', '/ru/gallery', '/ru/contact']) {
      const { tags } = await render('global', path);
      const image = head(tags).og('og:image');

      expect(image, path).toBeDefined();
      expect(image, path).toMatch(/^https?:\/\//);
      expect(head(tags).meta('twitter:card'), path).toBe('summary_large_image');
    }

    const { tags } = await render('umrah', '/tm');
    expect(head(tags).og('og:image')).toBeDefined();
  });

  it('sends a derivative rather than the original, and says how big it is', async () => {
    /*
     * The originals here run past eight hundred kilobytes. Facebook, Telegram and WhatsApp all
     * fetch that file themselves, on a timer, and WhatsApp gives up somewhere around a quarter
     * of a megabyte — so the forwarded link showed no picture at all, silently, in the app this
     * audience forwards links in.
     */
    const { tags } = await render('global', '/ru/tours/klassicheskiy-turkmenistan');
    const image = head(tags).og('og:image') ?? '';

    expect(image).toContain('/img/');
    expect(image).toMatch(/[?&]w=\d+$/);
    expect(Number(/w=(\d+)/.exec(image)?.[1])).toBeLessThanOrEqual(1280);

    // Both, or neither: a card told a width and left to guess the height reflows once the
    // bytes land, which is the jump the tags are there to prevent. 2400×1600 asked for at
    // 1280 is 853 high — computed from the row, not assumed to be 16:9.
    expect(head(tags).og('og:image:width')).toBe('1280');
    expect(head(tags).og('og:image:height')).toBe('853');
    // And what a screen reader says instead of the picture, in the language of the page.
    expect(head(tags).og('og:image:alt')).toBe('Пустыня на рассвете');
  });

  it('preloads the file the page will actually ask for, and only on a homepage', async () => {
    /*
     * The hint was making the number it exists to improve worse.
     *
     * It preloaded `og:image` — one fixed width — while the hero renders through `Img` with
     * seven candidates and `sizes="100vw"`. On a wide window the browser fetched `?w=1280` from
     * the preload and then `?w=1600` from the markup: a quarter of a megabyte spent twice on
     * the element LCP is measured against. With `imagesrcset` and `imagesizes` it runs the same
     * selection the `<img>` will, so both land on one file.
     */
    const { tags } = await render('global', '/ru');
    const preload = head(tags).links('preload')[0]?.attributes;

    expect(preload?.['as']).toBe('image');
    expect(preload?.['imagesizes']).toBe('100vw');
    // Relative, like the `srcSet` the browser builds from `media.url` (D-141) — the two have to
    // produce identical URLs or the deduplication this exists for does not happen.
    expect(preload?.['imagesrcset']).toContain('/api/v1/img/');
    expect(preload?.['imagesrcset']).not.toContain('http');
    expect(preload?.['imagesrcset']?.split(', ').length).toBeGreaterThan(4);

    // And not on a detail page: there the largest image is a cover whose width depends on the
    // layout, and a hint that guesses wrong is the fault above. No hint beats a wrong one.
    const detail = await render('global', '/ru/tours/klassicheskiy-turkmenistan');
    expect(head(detail.tags).links('preload')).toHaveLength(0);
  });

  it('starts both halves of the chooser, and does not outrank the script to do it', async () => {
    /*
     * The front door had the slowest largest paint of the three sites. Measured on a throttled
     * phone: 289 KB of photograph, discovered only once React had rendered, running from 1830ms
     * to 3595 — while the two homepages had been starting theirs from the head since phase 8.
     *
     * It was excluded on the rule that only a full-bleed hero can be hinted safely, and each
     * half is exactly as full-bleed as a hero: half the window above the tablet breakpoint and
     * all of it below, which is what `imageSizes.splitHalf` says.
     */
    const { tags } = await render('choice', '/ru');
    const preloads = head(tags).links('preload');

    expect(preloads).toHaveLength(2);
    for (const link of preloads) {
      expect(link.attributes?.['as']).toBe('image');
      expect(link.attributes?.['imagesizes']).toBe('(max-width: 1023px) 100vw, 59vw');
      /*
       * No `fetchpriority`, deliberately. A hero is the one thing on its page and deserves to
       * outrank the script; here the script is what draws the halves these go behind, so hinting
       * them high would move the pictures ahead of the thing that gives them somewhere to be.
       */
      expect(link.attributes?.['fetchpriority']).toBeUndefined();
    }

    // Global first, which is the order `ChoicePage` draws them in: a hint list is a queue, and
    // on a narrow connection the first one wins.
    expect(preloads[0]?.attributes?.['href']).toBeDefined();
  });

  it('shows that same file behind the spinner, instead of holding it back', async () => {
    /*
     * Measured on a throttled phone: the hero finished downloading at about two seconds and the
     * visitor first saw it at about three and a third — the splash is `position: fixed; inset: 0`
     * and opaque, so until React had mounted the whole homepage there was a spinner in front of a
     * photograph already in memory.
     *
     * The assertion that matters is the second one: it has to be the *same* URL the preload
     * started. A splash that named a different width would spend the picture twice and be worse
     * than the spinner it replaced.
     */
    const home = await render('global', '/ru');
    const preload = head(home.tags).links('preload')[0]?.attributes;

    expect(home.bootImage).toContain('<img');
    expect(home.bootImage).toContain(`src="${preload?.['href'] ?? 'no-preload'}"`);
    expect(home.bootImage).toContain(`srcset="${preload?.['imagesrcset'] ?? 'no-srcset'}"`);
    expect(home.bootImage).toContain('sizes="100vw"');
    // Decoration, and the real hero announces itself a moment later: two descriptions of one
    // photograph is one more than a screen reader should hear.
    expect(home.bootImage).toContain('alt=""');

    // Nowhere the preload does not go, for the same reason — see the test above.
    expect((await render('global', '/ru/tours')).bootImage).toBe('');
    expect((await render('choice', '/ru')).bootImage).toBe('');

    const umrah = await render('umrah', '/tm');
    expect(umrah.bootImage).toContain('<img');
  });

  it('paints the blurred thumbnail underneath, which is the half that works on a dense screen', async () => {
    /*
     * Measured on a throttled phone: the full-size hero is on screen for 597ms at one device
     * pixel per CSS pixel, 18ms at two, and never at three — at three it is four times the bytes
     * and React has taken the splash away before it lands. So on the phones most of this
     * audience carries, the photograph in the splash was a feature nobody would ever see.
     *
     * The thumbnail is already on the media row and already sent to the browser for the page's
     * own use. Inline, it costs no request and paints with the first frame, on every device.
     */
    const { bootImage } = await render('global', '/ru');

    expect(bootImage).toContain('data:image/webp;base64,');
    expect(bootImage).toContain('filter:blur(');
    // It has to be behind the real photograph, or it is a blur over a sharp picture.
    expect(bootImage.indexOf('data:image/webp')).toBeLessThan(bootImage.indexOf('<img'));
  });

  it('lays the hero’s own overlay over it, per site', async () => {
    /*
     * Without this the splash showed a bright desert and the page a dark one, and the 360ms
     * handover between them was a step change in brightness on the largest element either site
     * has. The gradient is `heroScrimCss` from contracts — the same function `bg-scrim-hero` is
     * built from — with the site's base substituted for the CSS variable, because no stylesheet
     * has loaded at the moment this element exists.
     *
     * Asserted per site rather than by re-deriving it here: re-deriving would restate the call
     * the code makes and prove nothing. What is worth stating is that the two differ, in base
     * and in direction, because a constant would be the bug this replaced.
     */
    const home = await render('global', '/ru');
    expect(home.bootImage).toContain(`rgba(${SCRIM_RGB.global}, 0.94) 0%`);
    expect(home.bootImage).toContain('linear-gradient(to top,');

    const umrah = await render('umrah', '/tm');
    expect(umrah.bootImage).toContain(`rgba(${SCRIM_RGB.umrah}, 0.94) 0%`);
    // Umrah's hero runs diagonally; a shared constant would have got this wrong and looked fine.
    expect(umrah.bootImage).toContain('linear-gradient(105deg,');
    expect(umrah.bootImage).not.toContain(SCRIM_RGB.global);
  });

  it('puts the splash picture inside the splash, and leaves a template without one alone', () => {
    const splash = '<body><div id="boot"><i></i></div><div id="root"></div></body>';

    const injected = injectBootImage(splash, '<img src="/x.webp" alt="">');
    expect(injected).toContain('<div id="boot"><img src="/x.webp" alt=""><i></i></div>');
    // The spinner stays, and stays last: it is what says the page is not finished yet.
    expect(injected.indexOf('<img')).toBeLessThan(injected.indexOf('<i>'));

    // A page with no splash — the admin — is served unchanged rather than guessed at, the same
    // rule `injectBody` follows for `#root`.
    const none = '<body><div id="root"></div></body>';
    expect(injectBootImage(none, '<img src="/x.webp" alt="">')).toBe(none);
    expect(injectBootImage(splash, '')).toBe(splash);
  });

  it('says so plainly when there is no photograph anywhere', async () => {
    // `summary_large_image` with nothing to fill it renders as a bare link in some clients —
    // worse than the small card, which at least shows the title.
    await context.app.db.update(t.heroSlides).set({ mediaId: null });
    await context.app.db.update(t.tours).set({ coverMediaId: null });

    const { tags } = await render('global', '/ru/contact');
    expect(head(tags).og('og:image')).toBeUndefined();
    expect(head(tags).meta('twitter:card')).toBe('summary');

    await context.app.db.update(t.heroSlides).set({ mediaId });
    await context.app.db.update(t.tours).set({ coverMediaId: mediaId });
  });
});

describe('the trail under a search result', () => {
  it('is published on a detail page, in the language of that page', async () => {
    const slug = context.discoveredSlugs.get('/api/v1/global/hotels/:slug');
    expect(slug).toBeDefined();

    const { tags } = await render('global', `/en/hotels/${slug!}`);
    const trail = head(tags).jsonLd.find((entry) => entry['@type'] === 'BreadcrumbList');

    expect(trail).toBeDefined();

    const steps = (trail?.['itemListElement'] ?? []) as { name: string; item: string }[];
    expect(steps).toHaveLength(3);
    expect(steps[0]).toMatchObject({ name: 'Home', item: `${ORIGIN}/en` });
    expect(steps[1]).toMatchObject({ name: 'Hotels', item: `${ORIGIN}/en/hotels` });
    expect(steps[2]?.item).toBe(`${ORIGIN}/en/hotels/${slug!}`);
  });

  it('is absent from a page that is not below anything', async () => {
    // A trail of one item is what Google discards anyway, and a section page claiming a trail
    // to itself is a claim about a hierarchy that does not exist.
    const { tags } = await render('global', '/ru/tours');
    expect(head(tags).jsonLd.find((entry) => entry['@type'] === 'BreadcrumbList')).toBeUndefined();
  });

  it('never names a step that is not a page', async () => {
    /*
     * Google fetches every step of a breadcrumb it is given, so a trail through a URL that
     * answers 404 is worse than a short trail. The journal is why this test exists: its middle
     * step had to be left out while there was no `/articles` page, and had to come back the day
     * there was one — a pair of edits in two packages that nothing would otherwise connect.
     *
     * So the assertion is about every step of every trail rather than about the journal: each
     * one has to resolve to a real route on this site.
     */
    const details: [string, string | undefined][] = [
      ['tours', context.discoveredSlugs.get('/api/v1/global/tours/:slug')],
      ['hotels', context.discoveredSlugs.get('/api/v1/global/hotels/:slug')],
      ['articles', context.discoveredSlugs.get('/api/v1/global/articles/:slug')],
    ];

    for (const [section, slug] of details) {
      expect(slug, section).toBeDefined();

      const { tags } = await render('global', `/ru/${section}/${slug!}`);
      const trail = head(tags).jsonLd.find((entry) => entry['@type'] === 'BreadcrumbList');
      const steps = (trail?.['itemListElement'] ?? []) as { name: string; item: string }[];

      expect(steps.length, section).toBeGreaterThanOrEqual(2);
      expect(steps[0]?.item, section).toBe(`${ORIGIN}/ru`);
      expect(steps.at(-1)?.item, section).toBe(`${ORIGIN}/ru/${section}/${slug!}`);

      for (const step of steps) {
        const resolved = resolveRoute('global', step.item.replace(ORIGIN, ''));
        expect(resolved.matched, `${section}: ${step.item}`).toBe(true);
      }
    }
  });
});

describe('the counters', () => {
  const scripts = (tags: HeadTag[]) =>
    tags
      .filter((tag) => tag.tag === 'script' && tag.attributes?.['type'] !== 'application/ld+json')
      .map((tag) => `${tag.attributes?.['src'] ?? ''} ${tag.text ?? ''}`)
      .join('\n');

  afterEach(async () => {
    await context.app.db
      .update(t.settings)
      .set({ value: { metrika: '', ga: '' } })
      .where(eq(t.settings.settingKey, 'analytics'));
  });

  it('emits nothing at all while no counter is configured', async () => {
    /*
     * The seeded row is empty, and an empty row must produce an empty head.
     *
     * A snippet sitting on the page with a placeholder id is worse than no snippet: it costs a
     * request, it reports nowhere, and it looks installed — which is how a site ends up never
     * being measured because everybody assumed it already was.
     */
    const { tags } = await render('global', '/ru');
    expect(scripts(tags)).toBe('');
  });

  it('loads what it is given, and tells the application too', async () => {
    await context.app.db
      .update(t.settings)
      .set({ value: { metrika: '98765432', ga: 'G-ABC1234567' } })
      .where(and(eq(t.settings.settingKey, 'analytics'), eq(t.settings.site, 'global')));

    const { tags } = await render('global', '/ru');
    const text = scripts(tags);

    expect(text).toContain('mc.yandex.ru/metrika/tag.js');
    expect(text).toContain('98765432');
    expect(text).toContain('googletagmanager.com/gtag/js?id=G-ABC1234567');
    // The applications report every route change after the first, and read the ids from here
    // rather than from a build-time constant they would have to be kept in step with.
    expect(text).toContain('window.__charvaAnalytics=');
  });

  it('ignores an id that is not shaped like one', async () => {
    // A settings row is free text somebody types. `<script>` in a counter number would be the
    // one place on these sites where an admin field reaches a browser unescaped.
    await context.app.db
      .update(t.settings)
      .set({ value: { metrika: '</script><script>alert(1)</script>', ga: 'not-an-id' } })
      .where(and(eq(t.settings.settingKey, 'analytics'), eq(t.settings.site, 'global')));

    const { tags } = await render('global', '/ru');
    expect(scripts(tags)).toBe('');
  });
});

describe('the sitemap', () => {
  it('lists every published page in every language the site speaks', async () => {
    const entries = await collectEntries(context.app.db, 'global');
    const xml = renderSitemap('global', ORIGIN, entries);

    const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

    // One URL per entry per language the site serves, and nothing outside this origin. The
    // multiplier is read from `SITE_LANGS` rather than written: it was three until Turkish was
    // retired (Q-17), and a literal there fails for naming yesterday rather than for a fault.
    expect(locations).toHaveLength(entries.length * SITE_LANGS.global.length);
    expect(locations.every((url) => url?.startsWith(ORIGIN))).toBe(true);

    for (const lang of SITE_LANGS.global) {
      expect(locations, lang).toContain(`${ORIGIN}/${lang}/tours`);
    }
    expect(locations).toContain(`${ORIGIN}/ru/tours/klassicheskiy-turkmenistan`);

    // A retired language leaves the sitemap, which is the point of building it from
    // `SITE_LANGS`: telling a crawler about a URL that now redirects is how a redirect gets
    // treated as a soft 404 instead of a move.
    expect(locations).not.toContain(`${ORIGIN}/tr/tours`);
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

  it('leaves out a section that has nothing behind it', async () => {
    /*
     * `/video` is six rows with no film attached — the shoots have not happened — so the page
     * renders an empty grid. A URL a sitemap promises and a crawler finds empty is a soft 404,
     * and Google holds those against the site rather than against the page. The section stays
     * in the navigation; it is simply not advertised until it has something.
     */
    const paths = (await collectEntries(context.app.db, 'global')).map((e) => e.pathAfterLang);
    expect(paths).not.toContain('/video');
    expect(paths).toContain('/tours');

    // And it comes back on its own the day something is published there, with no code change.
    await context.app.db.update(t.videos).set({ isPublished: true, mediaId: 1 });
    const after = (await collectEntries(context.app.db, 'global')).map((e) => e.pathAfterLang);
    expect(after).toContain('/video');

    await context.app.db.update(t.videos).set({ isPublished: false, mediaId: null });
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

  it('opens the public sites, photographs included, and points at their own sitemap', () => {
    const robots = renderRobots('global', ORIGIN);
    expect(robots).toContain('Allow: /');
    expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);

    /*
     * Nothing is disallowed, and `/img/` is the one that changed.
     *
     * It used to be blocked so that a search result would not point at a resized WebP instead
     * of the page showing it — but that is not what an image result does, it links to the page,
     * and every `<img>` on both sites is served from `/img/…?w=`. The rule blocked the entire
     * photographic contents of a site that is made of photographs.
     */
    expect(robots).not.toContain('Disallow:');
  });
});

describe('the sitemap tells a crawler when a section last changed', () => {
  it('dates a list page from the rows behind it', async () => {
    const entries = await collectEntries(context.app.db, 'global');
    const hotels = entries.find((entry) => entry.pathAfterLang === '/hotels');

    // `/hotels` is sixteen rows, not fixed markup: it changed the day they arrived, and a
    // crawler with no date has no reason to come back and look.
    expect(hotels?.lastModified).toBeInstanceOf(Date);

    const [row] = await context.app.db
      .select({ at: t.hotels.updatedAt })
      .from(t.hotels)
      .orderBy(desc(t.hotels.updatedAt))
      .limit(1);

    expect(hotels?.lastModified?.toISOString().slice(0, 10)).toBe(
      row?.at.toISOString().slice(0, 10),
    );
  });

  it('dates every page it lists, not only the detail ones', async () => {
    const xml = renderSitemap('global', ORIGIN, await collectEntries(context.app.db, 'global'));

    expect(xml.match(/<lastmod>/g)?.length).toBe(xml.match(/<url>/g)?.length);
    // A date, not a timestamp: the spec accepts both and a day is the honest precision here.
    expect(xml).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
  });
});

describe('the body a crawler that renders nothing receives', () => {
  it('names the page and links to the rest of the site', async () => {
    const { body } = await render('global', '/ru/tours');

    // The heading is the page's own title, which is where the head takes it from too: one
    // string, two places it appears, no second copy to drift (D-84).
    expect(body).toContain('<h1>Готовые туры по Туркменистану</h1>');

    // And the links are real hrefs, which is the whole reason this exists: before it, a
    // crawler that skipped the render step saw twenty pages and not one link between them.
    expect(body).toContain('href="/ru/hotels"');
    expect(body).toContain('href="/ru/turkmenistan"');
    expect(body).toContain('href="/ru/contact"');
  });

  it('strips the brand from the anchor text but not from the heading', async () => {
    const { body } = await render('global', '/ru');

    // «Отели Туркменистана — Charva Travel» is right for a tab and wrong for a link: twenty
    // anchors ending in the same three words carry less than twenty that do not.
    expect(body).toMatch(/<a href="\/ru\/hotels">[^<]*<\/a>/);
    expect(body).not.toMatch(/<a href="\/ru\/hotels">[^<]*Charva Travel<\/a>/);
  });

  it('leaves the page it is on out of its own list', async () => {
    const { body } = await render('global', '/ru/hotels');

    // The `<h1>` above is already that page's name; a self-link carries nothing to follow.
    expect(body).toContain('<h1>Отели Туркменистана</h1>');
    expect(body).not.toContain('href="/ru/hotels"');
    expect(body).toContain('href="/ru/tours"');
  });

  it('links every row a section lists, not only the ones the first screen shows', async () => {
    /*
     * Measured against the live site before this existed: eight of Global's thirty-six Russian
     * addresses were named by the sitemap and linked from nowhere a crawler starts — seven
     * hotels and an article. «Показать ещё» raises the page size rather than paging (D-61),
     * which is right for a reader and invisible to anything that only follows `href`s, so a
     * catalogue of sixteen hotels was a catalogue of nine as far as indexing went. Search
     * Console reported thirty-seven of a hundred URLs as «обнаружена, не проиндексирована».
     *
     * The check is against the sitemap rather than against a number, because the two have to
     * agree: an address offered by one and withheld by the other is the same half-applied rule
     * D-144 exists to prevent.
     */
    const { body } = await render('global', '/ru/hotels');
    const hotels = (await collectEntries(context.app.db, 'global'))
      .map((entry) => entry.pathAfterLang)
      .filter((path) => path.startsWith('/hotels/'));

    expect(hotels.length).toBeGreaterThan(0);
    for (const path of hotels) expect(body, path).toContain(`href="/ru${path}"`);

    // Counted as well as checked one by one: the failure this guards against is truncation, and
    // a loop over the sitemap would pass just as happily against a body that listed more.
    const linked = [...body.matchAll(/href="\/ru\/hotels\/[^"]+"/g)].length;
    expect(linked).toBe(hotels.length);

    // And each anchor says the hotel's name, not its slug: a link whose text is
    // `yyldyz-hotel` carries nothing a reader or a crawler can weigh.
    expect(body).toMatch(/<a href="\/ru\/hotels\/[a-z0-9-]+">[^<]*[А-Яа-яA-Za-z][^<]*<\/a>/);
  });

  it('lists nothing extra on a page that lists nothing', async () => {
    // The rule is «this section's own rows», not «some rows»: a contact page advertising the
    // hotel catalogue would be writing a link graph rather than describing one.
    const { body } = await render('global', '/ru/contact');
    expect(body).not.toContain('href="/ru/hotels/');
  });

  it('leaves out a section with nothing in it, exactly as the sitemap does', async () => {
    /*
     * One list, two readers (D-144). A page advertised here and withheld from the sitemap — or
     * the reverse — would be the emptiness rule applied half the time, which is worse than not
     * applying it: the two would disagree about what the site offers.
     */
    const { body } = await render('global', '/ru');
    const listed = (await collectEntries(context.app.db, 'global'))
      .map((entry) => entry.pathAfterLang)
      .filter((path) => !path.includes('/', 1) && path !== '');

    for (const path of ['/tours', '/hotels', '/gallery', '/video', '/reviews', '/articles']) {
      const offered = body.includes(`href="/ru${path}"`);
      expect(offered, path).toBe(listed.includes(path));
    }
  });

  it('carries the tour’s own name on a detail page', async () => {
    const [tour] = await context.app.db
      .select({ slug: t.tours.slug })
      .from(t.tours)
      .where(eq(t.tours.isPublished, true))
      .limit(1);

    const { body } = await render('global', `/ru/tours/${tour?.slug ?? ''}`);

    // Not the section's title: a detail page whose fallback said «Готовые туры» would describe
    // the wrong page to every reader that cannot run the application.
    expect(body).not.toContain('<h1>Готовые туры по Туркменистану</h1>');
    expect(body).toMatch(/<h1>.+<\/h1>/);
  });

  it('sends the chooser across to the two brands, since that is all it is', async () => {
    const { body } = await render('choice', '/ru');

    // Its own page list is one entry — itself. The links that matter are cross-origin, and
    // they are how a crawler learns the two brands are one operator (D-131).
    expect(body).toContain('href="https://global.charva-travel.com"');
    expect(body).toContain('href="https://umra.charva-travel.com"');
  });

  it('escapes what an editor typed, because a tour title is not trusted markup', async () => {
    const { body } = await render('global', '/ru');
    expect(body).not.toMatch(/<script/i);
    expect(body.match(/<h1>/g)?.length).toBe(1);
  });

  it('goes inside #root, so React takes it away without being asked', () => {
    const html = injectBody('<body><div id="root"></div></body>', '<h1>Туры</h1>');
    expect(html).toBe('<body><div id="root"><h1>Туры</h1></div></body>');
  });

  it('leaves a template it does not recognise alone rather than guessing', () => {
    // Failing by doing nothing: this is an improvement for crawlers, and a shell that threw
    // here would take the site down for everybody in order to protect it.
    const odd = '<body><div id="app"></div></body>';
    expect(injectBody(odd, '<h1>Туры</h1>')).toBe(odd);
  });
});

describe('the chooser warms the connections it is about to need', () => {
  it('preconnects to both brand hosts, before anything else in the head', async () => {
    /*
     * The owner reported a white screen between choosing and arriving. It is not slowness: both
     * answers live on other hosts, so a click is a cross-origin navigation and the browser has
     * to resolve, connect and shake hands before the first byte of the new page exists —
     * measured at 1.5 to 2.1 seconds, of which the handshake is about 1.4. Chrome holds the old
     * page for roughly half a second and then paints white.
     *
     * Asserted as the *first* tags, because a hint that arrives after four kilobytes of head has
     * given away most of what it was for.
     */
    const { tags } = await render('choice', '/ru');
    const hrefs = (rel: string) =>
      tags
        .filter((tag) => tag.tag === 'link' && tag.attributes?.['rel'] === rel)
        .map((tag) => tag.attributes?.['href']);

    expect(hrefs('preconnect')).toEqual([
      'https://global.charva-travel.com',
      'https://umra.charva-travel.com',
    ]);
    expect(hrefs('dns-prefetch')).toHaveLength(2);
    expect(tags[0]?.attributes?.['rel']).toBe('preconnect');
  });

  it('does not carry crossorigin, which a navigation cannot use', async () => {
    // `crossorigin` warms the anonymous connection pool; a top-level navigation uses the
    // credentialled one. Getting this wrong opens a socket the click cannot reuse, which is
    // exactly how preconnect earns its reputation for doing nothing.
    const { tags } = await render('choice', '/ru');
    const preconnects = tags.filter(
      (tag) => tag.tag === 'link' && tag.attributes?.['rel'] === 'preconnect',
    );

    expect(preconnects).toHaveLength(2);
    for (const tag of preconnects) {
      expect(tag.attributes?.['crossorigin']).toBeUndefined();
    }
  });

  it('is emitted by the chooser only', async () => {
    // The two sites link to each other from the footer, which nobody is about to click; two
    // idle sockets are worth it on the page whose only purpose is to leave for one of them.
    for (const site of ['global', 'umrah'] as const) {
      const { tags } = await render(site, site === 'global' ? '/ru' : '/tm');
      expect(
        tags.filter((tag) => tag.attributes?.['rel'] === 'preconnect'),
        site,
      ).toHaveLength(0);
    }
  });
});

describe('sameAs lists profiles, not ways to send a message', () => {
  it('carries the accounts that identify the operator', async () => {
    const { tags } = await render('global', '/ru');
    const agency = head(tags).jsonLd[0];
    const sameAs = (agency?.['sameAs'] ?? []) as string[];

    // Four real accounts were given for Global; three of the seven fields are empty and an
    // empty field is not an account.
    expect(sameAs).toContain('https://www.instagram.com/travelcharva');
    expect(sameAs).toContain('https://www.tiktok.com/@travel.charva.tour');
    expect(sameAs).toContain('https://www.facebook.com/share/188QSMAdnQ/');
    expect(sameAs.every((url) => url !== '')).toBe(true);
  });

  it('leaves out the chat links, which identify nobody', async () => {
    /*
     * `sameAs` means «other pages that are this same entity», and a search engine uses it to
     * decide that a site and an Instagram account are one business. A click-to-chat link is not
     * that: `wa.me/993…` and an imo invite open a conversation. Listing them among an
     * organisation's profiles is a claim that does not parse, and a set with noise in it stops
     * being trusted as a whole — which is why this is asserted rather than left to judgement.
     */
    const { tags } = await render('global', '/ru');
    const sameAs = (head(tags).jsonLd[0]?.['sameAs'] ?? []) as string[];

    expect(sameAs.some((url) => url.includes('imoim.net'))).toBe(false);
    expect(sameAs.some((url) => url.includes('wa.me'))).toBe(false);

    // And the imo address is still in the settings the footer reads — it is a channel, not a
    // profile, so it belongs on the page and not in the structured data.
    const settings = await context.app.inject({
      method: 'GET',
      url: `${API_PREFIX}/global/settings?lang=ru`,
    });
    const body = settings.json<{ socials: Record<string, string> }>();
    expect(body.socials['imo']).toContain('imoim.net');
  });

  it('keeps the tracking token out of the Instagram address', async () => {
    // The link arrived as `instagram.com/travelcharva?stkn=…`. That token belongs to whoever
    // copied it, not to the account, and a settings row is published on every page of the site.
    const { tags } = await render('global', '/ru');
    const sameAs = (head(tags).jsonLd[0]?.['sameAs'] ?? []) as string[];

    expect(sameAs.some((url) => url.includes('stkn='))).toBe(false);
  });
});
