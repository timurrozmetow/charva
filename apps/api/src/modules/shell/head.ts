import {
  contentMeta,
  hreflangSet,
  type Lang,
  type RouteMeta,
  routeMeta,
  type Site,
  SITE_BRAND,
  SITE_ORIGINS,
  type SiteRoute,
} from '@charva/contracts';

import { escapeJsonLd, type HeadTag } from './html';

/**
 * Everything that goes in `<head>`, as data.
 *
 * Kept apart from the HTML so it can be asserted on directly: a test that reads tags is a test
 * about the head, while a test that greps a string is a test about string building. The two
 * failures look identical in a diff and are not the same bug.
 */

/**
 * The photograph a link to this page shows when it is pasted somewhere.
 *
 * Dimensions ride along because the consumers use them. Telegram and Facebook lay the card out
 * before the file has finished arriving, and a card whose size is unknown is drawn small and
 * then reflowed; `og:image:alt` is what a screen reader announces in place of the picture.
 */
export interface ShareImage {
  url: string;
  width: number | null;
  height: number | null;
  alt: string;
  /**
   * The same candidates the `<img>` will offer, relative like its own.
   *
   * Only used by the preload, and only so that the preload asks for the file the page is
   * actually going to use — see the note on `preloadTags`.
   */
  srcSet: string | null;
  /**
   * A blurred thumbnail as a data URI, around a hundred characters, stored on the media row.
   *
   * Used only by the splash — it is what the loading screen paints while the full file is still
   * arriving, and it is the reason that feature works on a three-times-density phone at all.
   */
  lqip: string | null;
}

/**
 * The photograph a homepage opens with, or null everywhere else.
 *
 * One predicate for two readers — the `preload` hint below and the splash image the shell puts
 * in `#boot` — because they must name the same file or the second one downloads a picture the
 * first did not ask for, which would be worse than not doing it at all.
 */
export function heroImage(context: ShellContext): ShareImage | null {
  if (context.route !== 'home' || context.site === 'choice') return null;
  return context.content?.image ?? context.defaultImage ?? null;
}

/**
 * What to start before the bundle has parsed, and the `sizes` each one will be chosen by.
 *
 * A hint carries the whole candidate list rather than one URL, and that is not decoration. It
 * used to preload `og:image`, which is a single fixed width, while the hero renders through
 * `Img` with a seven-candidate `srcSet` — so on a 1600-pixel window the browser preloaded
 * `?w=1280` (255 KB), then read the markup, picked `?w=1600` (353 KB) and fetched that too. A
 * quarter of a megabyte wasted at the most expensive moment of the load, on the element LCP is
 * measured against: the hint was making the number it exists to improve worse. With
 * `imagesrcset` and `imagesizes` it runs the same selection the `<img>` will, so both land on
 * one file — and that is why the `sizes` string below has to be the one the component passes.
 *
 * Two shapes, and the second was missing for a long time. A homepage has one full-bleed hero, so
 * `100vw` is known to be right. The chooser has *two* photographs, one per half, and it was
 * excluded here on the reasoning that only a full-bleed hero can be hinted safely — but each
 * half is exactly as full-bleed as a hero, it is simply half of the window above the tablet
 * breakpoint and all of it below. `imageSizes.splitHalf` already says so, in the one place that
 * decides it.
 *
 * Leaving it out cost the front door. Measured on a throttled phone: the chooser's two
 * photographs are 289 KB, they were discovered only once React had rendered, and they ran from
 * 1830ms to 3595 — so the first page anybody sees on this domain had the slowest largest paint
 * of the three sites.
 *
 * Note the absence of `fetchpriority` on those two. A hero is the one thing on its page and
 * deserves to outrank the script; here the script is what draws the halves the photographs go
 * behind, so hinting them as high would move the pictures ahead of the thing that gives them
 * somewhere to be.
 */
function preloadImages(
  context: ShellContext,
): { image: ShareImage; sizes: string; lead: boolean }[] {
  const hero = heroImage(context);
  if (hero !== null) return [{ image: hero, sizes: '100vw', lead: true }];

  return context.splitImages.map((image) => ({
    image,
    // The same string `ChoiceHalf` passes to `ImageSlot`; a hint that guesses a different width
    // asks for a second copy of the same photograph, which is the fault this file warns about.
    sizes: '(max-width: 1023px) 100vw, 59vw',
    lead: false,
  }));
}

function preloadTags(context: ShellContext): HeadTag[] {
  return preloadImages(context).map(({ image, sizes, lead }) => ({
    tag: 'link' as const,
    attributes: {
      rel: 'preload',
      as: 'image',
      href: image.url,
      /*
       * `fetchpriority` on the hero, and only on the hero.
       *
       * Without it a preload is an ordinary-priority fetch while the `<img>` it feeds carries
       * `fetchpriority="high"`: the hint arrives first and is then overtaken by every script on
       * the page. Lighthouse names this exactly — «для запроса предварительной загрузки
       * изображения требуется fetchpriority=high» — and it was the one line of the LCP insight
       * that was our own doing.
       *
       * The chooser's two halves deliberately go without it; see `preloadImages`.
       */
      ...(lead ? { fetchpriority: 'high' } : {}),
      ...(image.srcSet === null ? {} : { imagesrcset: image.srcSet, imagesizes: sizes }),
    },
  }));
}

/**
 * The white screen between the chooser and the site it sends you to.
 *
 * Reported by the owner, and it is not slowness — it is arithmetic. The chooser is on
 * `charva-travel.com` and both its answers are on *other* hosts, so a click is a cross-origin
 * navigation: the browser has to resolve a name, open a socket and complete a TLS handshake
 * before the first byte of the new page can arrive. Measured from here, that is 1.5 to 2.1
 * seconds, of which the handshake alone is about 1.4. Chrome holds the old page for roughly
 * half a second and then paints white, so the visitor watches a blank screen for a second or
 * more between deciding and arriving.
 *
 * `preconnect` moves all of it earlier: the name is resolved and the connection is opened and
 * secured *while the visitor is still looking at the chooser*, so the click spends its time on
 * the request rather than on getting ready to make one. Two idle sockets is the whole cost, on
 * a page whose entire purpose is to send you to one of exactly two places — this is the case
 * the hint was invented for.
 *
 * No `crossorigin`: that attribute warms the anonymous connection pool, and a top-level
 * navigation uses the credentialled one. Getting it wrong here opens a socket the navigation
 * cannot use, which is the failure mode that makes people believe preconnect does nothing.
 *
 * `dns-prefetch` beside it is for browsers that ignore the first: it is a much smaller win —
 * four milliseconds here, since the name is usually already cached — but it costs one tag.
 *
 * The origins come from `SITE_ORIGINS` rather than from this file (D-131), which also means
 * the tags are emitted only in production: in development the shell is not in the path and the
 * chooser links to localhost, where none of this matters.
 */
function preconnectTags(context: ShellContext): HeadTag[] {
  if (context.site !== 'choice') return [];

  return (['global', 'umrah'] as const).flatMap((target) => [
    { tag: 'link' as const, attributes: { rel: 'preconnect', href: SITE_ORIGINS[target] } },
    { tag: 'link' as const, attributes: { rel: 'dns-prefetch', href: SITE_ORIGINS[target] } },
  ]);
}

export interface ShellContext {
  site: Site;
  lang: Lang;
  route: SiteRoute<Site>;
  /** Absolute origin of the site being rendered — `https://global.charva-travel.com`. */
  origin: string;
  pathAfterLang: string;
  /** A tour, hotel, article or place, when the path named one and it exists. */
  content?:
    | { name: string; summary?: string | null | undefined; image?: ShareImage | null | undefined }
    | undefined;
  /** What this page shows when it has no row of its own — the section's own first photograph. */
  defaultImage?: ShareImage | null | undefined;
  /**
   * The chooser's two half photographs, in the order they are drawn. Empty everywhere else.
   *
   * Separate from `defaultImage` because they are not a share card and not a hero: they are two
   * pictures on one page, each half the window wide above the tablet breakpoint, and the only
   * thing the head does with them is start them early.
   */
  splitImages: readonly ShareImage[];
  /** Structured data for this page, already shaped. */
  jsonLd?: unknown[] | undefined;
  /** Counter ids from `settings`. Absent or empty means no script is emitted at all. */
  analytics?: { metrika: number | null; ga: string | null } | undefined;
}

/**
 * The counters, loaded from the head so the first page is recorded before the bundle runs.
 *
 * Both snippets are the vendors' own, with two deliberate departures. The ids are interpolated
 * from `settings` rather than typed in, so nothing here can end up reporting into the account of
 * whoever last copied a snippet off a blog; and the pair is also written to
 * `window.__charvaAnalytics`, which is how the applications know whether to report a route
 * change without importing a key they would then have to keep in step.
 *
 * Nothing is emitted when nothing is configured. A page with a counter stub and no id is worse
 * than a page with no counter: it costs a request, it reports nowhere, and it looks installed.
 */
function analyticsTags(analytics: ShellContext['analytics']): HeadTag[] {
  const metrika = analytics?.metrika ?? null;
  const ga = analytics?.ga ?? null;
  if (metrika === null && ga === null) return [];

  const tags: HeadTag[] = [
    {
      tag: 'script',
      text: `window.__charvaAnalytics=${JSON.stringify({
        ...(metrika === null ? {} : { metrika }),
        ...(ga === null ? {} : { ga }),
      })};`,
    },
  ];

  if (metrika !== null) {
    tags.push({
      tag: 'script',
      text:
        `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};` +
        `m[i].l=1*new Date();for(var j=0;j<e.scripts.length;j++){if(e.scripts[j].src===r)return;}` +
        `k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,` +
        `a.parentNode.insertBefore(k,a)})` +
        `(window,document,'script','https://mc.yandex.ru/metrika/tag.js','ym');` +
        // `defer: true` because the applications report views themselves: without it the first
        // route change is counted twice, once by the counter and once by `trackPageview`.
        `ym(${String(metrika)},'init',{defer:true,clickmap:true,trackLinks:true,` +
        `accurateTrackBounce:true,webvisor:true});` +
        `ym(${String(metrika)},'hit',location.href);`,
    });
  }

  if (ga !== null) {
    tags.push(
      {
        tag: 'script',
        attributes: {
          async: 'async',
          src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga)}`,
        },
      },
      {
        tag: 'script',
        text:
          `window.dataLayer=window.dataLayer||[];` +
          `function gtag(){dataLayer.push(arguments);}gtag('js',new Date());` +
          // The applications send every later view, so the automatic one is turned off here for
          // the same reason Metrika's is deferred.
          `gtag('config',${JSON.stringify(ga)},{send_page_view:true});`,
      },
    );
  }

  return tags;
}

export function buildHead(context: ShellContext): HeadTag[] {
  const section = routeMeta(context.site, context.route, context.lang);
  const meta = resolveMeta(context, section);
  const canonical = absolute(context, context.lang);
  const image = context.content?.image ?? context.defaultImage ?? null;

  const tags: HeadTag[] = [
    // First, and before the title: a preconnect is a race against the visitor's finger, and
    // every byte of head in front of it is a byte of head-start given away.
    ...preconnectTags(context),
    { tag: 'title', text: meta.title },
    { tag: 'meta', attributes: { name: 'description', content: meta.description } },
    { tag: 'link', attributes: { rel: 'canonical', href: canonical } },
  ];

  /*
   * `hreflang`, including `x-default`.
   *
   * Every language of this site points at the same page in that language — which is only true
   * because the path after the prefix is identical across languages, a property the routers
   * were built with. A slug that differed per language would make this a lie, and Google treats
   * a lying `hreflang` set as a reason to distrust all of them.
   */
  for (const { hreflang, lang } of hreflangSet(context.site)) {
    tags.push({
      tag: 'link',
      attributes: { rel: 'alternate', hreflang, href: absolute(context, lang) },
    });
  }

  tags.push(
    { tag: 'meta', attributes: { property: 'og:type', content: ogType(context.route) } },
    { tag: 'meta', attributes: { property: 'og:site_name', content: SITE_BRAND[context.site] } },
    { tag: 'meta', attributes: { property: 'og:title', content: meta.title } },
    { tag: 'meta', attributes: { property: 'og:description', content: meta.description } },
    { tag: 'meta', attributes: { property: 'og:url', content: canonical } },
    { tag: 'meta', attributes: { property: 'og:locale', content: ogLocale(context.lang) } },
  );

  if (image !== null) {
    tags.push(
      { tag: 'meta', attributes: { property: 'og:image', content: image.url } },
      /*
       * The card is only large if there is a picture to fill it.
       *
       * `summary_large_image` with no image renders as a bare link in some clients — worse than
       * the small card, which at least shows the title. So the card size follows the image.
       */
      { tag: 'meta', attributes: { name: 'twitter:card', content: 'summary_large_image' } },
      { tag: 'meta', attributes: { name: 'twitter:image', content: image.url } },
      ...preloadTags(context),
    );

    if (image.width !== null && image.height !== null) {
      tags.push(
        { tag: 'meta', attributes: { property: 'og:image:width', content: String(image.width) } },
        { tag: 'meta', attributes: { property: 'og:image:height', content: String(image.height) } },
      );
    }
    if (image.alt !== '') {
      tags.push({ tag: 'meta', attributes: { property: 'og:image:alt', content: image.alt } });
    }
  } else {
    tags.push({ tag: 'meta', attributes: { name: 'twitter:card', content: 'summary' } });
  }

  for (const entry of context.jsonLd ?? []) {
    tags.push({
      tag: 'script',
      attributes: { type: 'application/ld+json' },
      text: escapeJsonLd(entry),
    });
  }

  tags.push(...analyticsTags(context.analytics));

  return tags;
}

/**
 * The head of a detail page comes from the row; of a list page, from contracts.
 *
 * A row with no summary of its own still needs a description, and the section's is a true
 * statement about it — a tour with no summary is still one of the tours of Turkmenistan.
 */
export function resolveMeta(context: ShellContext, section: RouteMeta): RouteMeta {
  if (context.content === undefined) return section;

  const fromContent = contentMeta(context.site, context.content);
  return fromContent.description === ''
    ? { ...fromContent, description: section.description }
    : fromContent;
}

function absolute(context: ShellContext, lang: Lang): string {
  return `${context.origin}/${lang}${context.pathAfterLang}`;
}

/** `article` for the journal, `website` for everything else. */
function ogType(route: string): string {
  return route === 'article' ? 'article' : 'website';
}

/**
 * The territory in an `og:locale`.
 *
 * Facebook and Telegram want `language_TERRITORY`, and there is no `tm_TM` in their list —
 * Turkmen is `tk` in ISO 639-1 and this project calls it `tm` throughout (the browser's `tk`
 * is mapped on the way in). `tk_TM` is what a consumer will recognise.
 */
function ogLocale(lang: Lang): string {
  const map: Record<Lang, string> = {
    ru: 'ru_RU',
    en: 'en_US',
    tr: 'tr_TR',
    tm: 'tk_TM',
  };
  return map[lang];
}
