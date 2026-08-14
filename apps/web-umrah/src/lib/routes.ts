import { type Lang } from '@charva/contracts';

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

/** Where the other two sites live. Separate subdomains in production, separate ports locally. */
export const SITE_URLS = {
  choice: import.meta.env.VITE_CHOICE_URL ?? 'http://localhost:5180',
  global: import.meta.env.VITE_GLOBAL_URL ?? 'http://localhost:5181',
} as const;
