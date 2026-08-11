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
