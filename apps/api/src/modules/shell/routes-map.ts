import { DEFAULT_LANG, isSiteLang, type Lang, type Site, type SiteRoute } from '@charva/contracts';

/**
 * Which page is this URL?
 *
 * The SPAs answer this with TanStack Router, which the API cannot run and should not try to.
 * What it can do is match the same sixteen shapes, and the shapes are short enough to be a
 * table. The route *ids* come from `SITE_ROUTES` in contracts, so the two ends cannot drift
 * apart on what a page is called even though they disagree on how to recognise it.
 *
 * Unknown paths resolve to `notFound` rather than throwing: a crawler that follows a stale link
 * should get a page saying so, with a title, and not a 500.
 */

export interface ResolvedRoute<S extends Site = Site> {
  lang: Lang;
  route: SiteRoute<S>;
  /** The detail-page slug, when the pattern has one. */
  slug: string | null;
  /** The path with the language prefix removed — what `canonical` and `hreflang` are built on. */
  pathAfterLang: string;
  /**
   * Did a pattern actually match, or is this the fallback?
   *
   * Stated rather than inferred, because inferring it by comparing the route id against
   * `unmatchedRoute(site)` is wrong on the chooser: its fallback IS `home`, its only page, so
   * the comparison called every single chooser URL — including the homepage — a 404. The HTML
   * was right and browsers rendered it, so the only readers who ever saw the status were the
   * ones the shell exists for: Google and the Telegram card.
   */
  matched: boolean;
}

interface Pattern {
  /** Matched against the path after the language prefix. */
  test: RegExp;
  route: string;
}

const GLOBAL_PATTERNS: Pattern[] = [
  { test: /^\/?$/, route: 'home' },
  { test: /^\/tours\/([^/]+)$/, route: 'tours' },
  { test: /^\/tours\/?$/, route: 'tours' },
  { test: /^\/builder\/?$/, route: 'builder' },
  { test: /^\/hotels\/([^/]+)$/, route: 'hotels' },
  { test: /^\/hotels\/?$/, route: 'hotels' },
  { test: /^\/articles\/([^/]+)$/, route: 'article' },
  { test: /^\/turkmenistan\/?$/, route: 'country' },
  { test: /^\/reviews\/?$/, route: 'reviews' },
  { test: /^\/gallery\/?$/, route: 'gallery' },
  { test: /^\/video\/?$/, route: 'video' },
  { test: /^\/contact\/?$/, route: 'contact' },
  { test: /^\/credits\/?$/, route: 'credits' },
];

const UMRAH_PATTERNS: Pattern[] = [
  { test: /^\/?$/, route: 'home' },
  { test: /^\/paket\/?$/, route: 'paket' },
  { test: /^\/ziyarat\/([^/]+)$/, route: 'ziyarat' },
  { test: /^\/ziyarat\/?$/, route: 'ziyarat' },
  { test: /^\/maksatnama\/?$/, route: 'maksatnama' },
  { test: /^\/suratlar\/?$/, route: 'suratlar' },
  { test: /^\/yazylmak\/?$/, route: 'yazylmak' },
  { test: /^\/credits\/?$/, route: 'credits' },
];

const CHOICE_PATTERNS: Pattern[] = [{ test: /^\/?$/, route: 'home' }];

const PATTERNS: Record<Site, Pattern[]> = {
  choice: CHOICE_PATTERNS,
  global: GLOBAL_PATTERNS,
  umrah: UMRAH_PATTERNS,
};

export function resolveRoute<S extends Site>(site: S, rawPath: string): ResolvedRoute<S> {
  const path = rawPath.split('?')[0] ?? '/';
  const [, first = '', ...rest] = path.split('/');

  /*
   * The language prefix, if the first segment is one this site speaks.
   *
   * A path with no prefix at all is the bare `/`, which every SPA redirects from — but a
   * crawler may well have it, and answering with the default language's head is better than
   * answering with none.
   */
  const hasLang = isSiteLang(site, first);
  const lang: Lang = hasLang ? first : DEFAULT_LANG[site];
  const pathAfterLang = hasLang ? `/${rest.join('/')}` : path;

  for (const pattern of PATTERNS[site]) {
    const match = pattern.test.exec(pathAfterLang.replace(/\/$/, '') || '/');
    if (match === null) continue;

    return {
      lang,
      route: pattern.route as SiteRoute<S>,
      slug: match[1] ?? null,
      pathAfterLang: normalise(pathAfterLang),
      matched: true,
    };
  }

  return {
    lang,
    route: UNMATCHED[site] as SiteRoute<S>,
    slug: null,
    pathAfterLang: normalise(pathAfterLang),
    matched: false,
  };
}

/**
 * What an unrecognised path is, per site.
 *
 * The chooser has exactly one page and its router redirects everything to it, so there is no
 * such thing as a missing page there — answering with the chooser's own head is what actually
 * happens next. The two content sites have a real 404, and it has a title of its own.
 */
const UNMATCHED: Record<Site, string> = {
  choice: 'home',
  global: 'notFound',
  umrah: 'notFound',
};

/**
 * The route to render when there is no page — either the path matched nothing, or it matched a
 * detail pattern whose slug names no row.
 *
 * The second case is the one worth naming: the pattern is fine, the section exists, and the
 * only thing missing is the row. Answering with the section's own title would give a 404 a head
 * saying «Ready-made tours of Turkmenistan», which is a page that does not exist described as
 * one that does. The SPA already renders its 404 component there (D-69); this is the same
 * decision, made where a crawler can see it.
 */
export function unmatchedRoute<S extends Site>(site: S): SiteRoute<S> {
  return UNMATCHED[site] as SiteRoute<S>;
}

/** `/tours/` and `/tours` are one page and must produce one canonical. */
function normalise(pathAfterLang: string): string {
  const trimmed = pathAfterLang.replace(/\/+$/, '');
  return trimmed === '/' ? '' : trimmed;
}
