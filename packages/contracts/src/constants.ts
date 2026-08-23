/**
 * Sites and languages.
 *
 * These are compile-time constants, not a database table. A row nobody can add without also
 * shipping translation files, routes, a font with the right glyphs and a new enum member is a
 * stub — see CLAUDE.md, decision D-20. The design handoff's README §7 proposes a `languages`
 * table; this replaces it.
 *
 * The language set differs per site, and that is the whole point: Umrah is never Turkish, and
 * a `(entity_id, lang)` translations table cannot express that at the type level. A per-site
 * tuple can, and it is what makes `LocalizedText` narrow correctly in Phase 2.
 */

export const SITES = ['choice', 'global', 'umrah'] as const;
export type Site = (typeof SITES)[number];

/** Every language code that appears anywhere in the project. */
export const LANGS = ['ru', 'en', 'tr', 'tm'] as const;
export type Lang = (typeof LANGS)[number];

/**
 * Languages offered per site, in the order the switcher lists them.
 * The first entry of each tuple is that site's default.
 */
export const SITE_LANGS = {
  choice: ['ru', 'en', 'tr', 'tm'],
  global: ['ru', 'en', 'tr'],
  umrah: ['tm', 'ru'],
} as const satisfies Record<Site, readonly Lang[]>;

export type SiteLang<S extends Site> = (typeof SITE_LANGS)[S][number];

/** The language a site falls back to when the URL carries none. */
export const DEFAULT_LANG = {
  choice: 'ru',
  global: 'ru',
  umrah: 'tm',
} as const satisfies { [S in Site]: SiteLang<S> };

/** Human-readable names, shown in the language dropdown next to the code. */
export const LANG_NAMES = {
  ru: 'Русский',
  en: 'English',
  tr: 'Türkçe',
  tm: 'Türkmen',
} as const satisfies Record<Lang, string>;

/**
 * The same language as a machine has to be told it — BCP 47.
 *
 * `tm` is this project's internal key and it is **not** a language code: ISO 639-1 spells
 * Turkmen `tk`, and `TM` is the country. Three of the four codes happen to coincide with the
 * standard, which is why the fourth went unnoticed until Lighthouse called the Umrah pages'
 * `hreflang="tm"` an invalid language and refused the whole alternate set with it. The same
 * value sits on `<html lang>`, where a screen reader reads it to choose a voice.
 *
 * The URL keeps `/tm`. A path segment is not a language tag, it is an address that has already
 * been shared, and `og:locale` has spelled it `tk_TM` since Phase 8 without anyone minding.
 *
 * Use this at every point where the code leaves the project and reaches a parser: `hreflang`,
 * `<html lang>`, `Content-Language`. Everywhere inside, `Lang` stays what it is.
 */
export const BCP47: Record<Lang, string> = {
  ru: 'ru',
  en: 'en',
  tr: 'tr',
  tm: 'tk',
};

export function bcp47(lang: Lang): string {
  return BCP47[lang];
}

/** Narrowing guard for a `?lang=` parameter, scoped to what the site actually offers. */
export function isSiteLang<S extends Site>(site: S, value: string): value is SiteLang<S> {
  return (SITE_LANGS[site] as readonly string[]).includes(value);
}

/** Currency per site. Umrah prices exist but are never returned publicly — see D-12. */
export const SITE_CURRENCY = {
  choice: 'USD',
  global: 'USD',
  umrah: 'TMT',
} as const satisfies Record<Site, string>;
