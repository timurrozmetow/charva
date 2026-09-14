import {
  contentMeta,
  hreflangSet,
  type Lang,
  type RouteMeta,
  routeMeta,
  type Site,
  SITE_BRAND,
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
      // The LCP element on almost every page here is this same photograph.
      { tag: 'link', attributes: { rel: 'preload', as: 'image', href: image.url } },
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
function resolveMeta(context: ShellContext, section: RouteMeta): RouteMeta {
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
