import { type Lang } from '@charva/contracts';

/**
 * Every path this site has, built in one place.
 *
 * The language prefix is part of every URL, so it is part of every link, and a helper is what
 * stops that from being twenty template literals that mostly agree. It also makes the set of
 * routes readable at a glance, which the router's tree does not.
 */
export const path = {
  home: (lang: Lang) => `/${lang}`,
  tours: (lang: Lang) => `/${lang}/tours`,
  tour: (lang: Lang, slug: string) => `/${lang}/tours/${slug}`,
  builder: (lang: Lang) => `/${lang}/builder`,
  hotels: (lang: Lang) => `/${lang}/hotels`,
  hotel: (lang: Lang, slug: string) => `/${lang}/hotels/${slug}`,
  country: (lang: Lang) => `/${lang}/turkmenistan`,
  gallery: (lang: Lang) => `/${lang}/gallery`,
  video: (lang: Lang) => `/${lang}/video`,
  reviews: (lang: Lang) => `/${lang}/reviews`,
  contact: (lang: Lang) => `/${lang}/contact`,
  article: (lang: Lang, slug: string) => `/${lang}/articles/${slug}`,
} as const;

/**
 * Where the other two sites live.
 *
 * Separate subdomains in production, separate dev servers locally, so neither can be a relative
 * path. The ports are the ones in CLAUDE.md's map — chosen because the silkgrain project on
 * this machine already owns everything Vite picks by itself.
 */
export const SITE_URLS = {
  choice: import.meta.env.VITE_CHOICE_URL ?? 'http://localhost:5180',
  umrah: import.meta.env.VITE_UMRAH_URL ?? 'http://localhost:5182',
} as const;
