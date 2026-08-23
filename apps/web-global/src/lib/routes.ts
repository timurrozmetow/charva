import { type Lang, siteOrigin } from '@charva/contracts';

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
 * path. The address now comes from `SITE_ORIGINS` in `@charva/contracts` rather than from an
 * environment variable that nothing ever set — that variable is why the first production build
 * linked back to `http://localhost:5180`. It still overrides, for a staging domain.
 */
export const SITE_URLS = {
  choice: siteOrigin('choice', import.meta.env.PROD, import.meta.env.VITE_CHOICE_URL),
  umrah: siteOrigin('umrah', import.meta.env.PROD, import.meta.env.VITE_UMRAH_URL),
} as const;
