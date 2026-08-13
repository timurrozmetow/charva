import { DEFAULT_LANG, type Lang, SITE_LANGS } from '@charva/contracts';

/**
 * Which language to send a visitor arriving at `/` to.
 *
 * The redirect happens once, on the bare root, and every other URL carries its language. That
 * ordering matters: choosing from a header on *every* request would give two people different
 * content at one address, and a shared link would open in the sharer's language for nobody but
 * the sharer. Here the header only decides where to go the first time; after that the URL is
 * the answer.
 *
 * `navigator.languages` is in preference order and carries regional tags — `tk-TM`, `ru-RU`,
 * `tr-TR` — so each is cut at the dash before being compared.
 */
const OFFERED = SITE_LANGS.choice as readonly Lang[];

/**
 * The BCP-47 code for Turkmen is `tk`. This project's own code is `tm`.
 *
 * `tm` is the country (Turkmenistan), not the language, and it is what the design, the routes
 * and the database all use — changing it now would rename a column, four route prefixes and
 * every seeded row. So the browser's correct tag is mapped here, at the one place a browser
 * value enters the system, rather than the wrong one being spread further.
 */
const BROWSER_ALIASES: Record<string, Lang> = { tk: 'tm', tuk: 'tm' };

export function bestLang(preferred: readonly string[]): Lang {
  for (const candidate of preferred) {
    const base = candidate.toLowerCase().split('-')[0] ?? '';
    const mapped = BROWSER_ALIASES[base] ?? base;
    if (OFFERED.includes(mapped as Lang)) return mapped as Lang;
  }
  return DEFAULT_LANG.choice;
}

/** True for a value that may appear in the `$lang` route parameter. */
export function isChoiceLang(value: string): value is Lang {
  return OFFERED.includes(value as Lang);
}
