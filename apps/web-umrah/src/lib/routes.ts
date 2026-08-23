import { type Lang, siteOrigin } from '@charva/contracts';

/**
 * Every path this site has, built in one place.
 *
 * The segments are Turkmen because the audience is: `/tm/maksatnama` rather than `/tm/program`.
 * They do not change with the language — a URL is an identifier, and translating the path would
 * mean the Russian and Turkmen versions of one page are two different addresses to a crawler
 * and two different links in a WhatsApp message.
 */
export const path = {
  home: (lang: Lang) => `/${lang}`,
  paket: (lang: Lang) => `/${lang}/paket`,
  ziyarat: (lang: Lang) => `/${lang}/ziyarat`,
  ziyaratPlace: (lang: Lang, slug: string) => `/${lang}/ziyarat/${slug}`,
  maksatnama: (lang: Lang) => `/${lang}/maksatnama`,
  suratlar: (lang: Lang) => `/${lang}/suratlar`,
  yazylmak: (lang: Lang) => `/${lang}/yazylmak`,
} as const;

/**
 * Where the other two sites live. Separate subdomains in production, separate ports locally.
 * The address comes from `SITE_ORIGINS` in `@charva/contracts`; the variable only overrides it.
 */
export const SITE_URLS = {
  choice: siteOrigin('choice', import.meta.env.PROD, import.meta.env.VITE_CHOICE_URL),
  global: siteOrigin('global', import.meta.env.PROD, import.meta.env.VITE_GLOBAL_URL),
} as const;
