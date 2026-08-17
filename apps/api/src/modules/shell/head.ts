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

export interface ShellContext {
  site: Site;
  lang: Lang;
  route: SiteRoute<Site>;
  /** Absolute origin of the site being rendered — `https://global.charva-travel.com`. */
  origin: string;
  pathAfterLang: string;
  /** A tour, hotel, article or place, when the path named one and it exists. */
  content?:
    | { name: string; summary?: string | null | undefined; imageUrl?: string | null | undefined }
    | undefined;
  /** The site's default sharing image, from `settings`. */
  defaultImageUrl?: string | null | undefined;
  /** Structured data for this page, already shaped. */
  jsonLd?: unknown[] | undefined;
}

export function buildHead(context: ShellContext): HeadTag[] {
  const section = routeMeta(context.site, context.route, context.lang);
  const meta = resolveMeta(context, section);
  const canonical = absolute(context, context.lang);
  const image = context.content?.imageUrl ?? context.defaultImageUrl ?? null;

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
      { tag: 'meta', attributes: { property: 'og:image', content: image } },
      /*
       * The card is only large if there is a picture to fill it.
       *
       * `summary_large_image` with no image renders as a bare link in some clients — worse than
       * the small card, which at least shows the title. So the card size follows the image.
       */
      { tag: 'meta', attributes: { name: 'twitter:card', content: 'summary_large_image' } },
      // The LCP element on almost every page here is this same photograph.
      { tag: 'link', attributes: { rel: 'preload', as: 'image', href: image } },
    );
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
