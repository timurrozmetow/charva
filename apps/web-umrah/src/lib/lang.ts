import { DEFAULT_LANG, type Lang, SITE_LANGS } from '@charva/contracts';

/**
 * Which language a visitor arriving at `/` is sent to.
 *
 * Umrah offers two, and Turkmen is the default — the opposite of Global, where Russian is. The
 * per-site tuple in `SITE_LANGS` is what makes that a type rather than a convention.
 *
 * `tk` and `tuk` are the codes browsers actually send for Turkmen; `tm` is the country. The
 * three are aliased here for the same reason they are on Choice: a phone set to Turkmen should
 * land on the Turkmen page, and it does not announce itself as `tm`.
 */
const OFFERED = SITE_LANGS.umrah as readonly Lang[];

const BROWSER_ALIASES: Record<string, Lang> = { tk: 'tm', tuk: 'tm' };

export function bestLang(preferred: readonly string[]): Lang {
  for (const candidate of preferred) {
    const base = candidate.toLowerCase().split('-')[0] ?? '';
    const resolved = BROWSER_ALIASES[base] ?? base;
    if (OFFERED.includes(resolved as Lang)) return resolved as Lang;
  }
  return DEFAULT_LANG.umrah;
}

export function isUmrahLang(value: string): value is Lang {
  return OFFERED.includes(value as Lang);
}
