import { DEFAULT_LANG, type Lang, SITE_LANGS } from '@charva/contracts';

/**
 * Which language a visitor arriving at `/` is sent to.
 *
 * Global offers three, and Turkmen is deliberately not one of them: a Turkmen speaker looking
 * for a pilgrimage belongs on the other subdomain, and `SITE_LANGS` is a per-site tuple rather
 * than one shared list precisely so that asymmetry is a type rather than a convention.
 *
 * The header is consulted once, here, and never again. Every URL that renders anything carries
 * its language, because that is what gets shared into a Telegram group, cached and indexed —
 * and a page that chose its language from a header would serve two people different content at
 * one address.
 */
const OFFERED = SITE_LANGS.global as readonly Lang[];

export function bestLang(preferred: readonly string[]): Lang {
  for (const candidate of preferred) {
    const base = candidate.toLowerCase().split('-')[0] ?? '';
    if (OFFERED.includes(base as Lang)) return base as Lang;
  }
  return DEFAULT_LANG.global;
}

export function isGlobalLang(value: string): value is Lang {
  return OFFERED.includes(value as Lang);
}
