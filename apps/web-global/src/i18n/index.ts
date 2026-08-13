import { type Lang, type SiteLang } from '@charva/contracts';

import en from './en.json';
import ru from './ru.json';
import tr from './tr.json';

/**
 * Interface copy, as versioned files in the repository — decision D-23.
 *
 * Content lives in the database and is edited without a deploy; the words *around* the content
 * change together with the markup they sit in, are reviewed together with it, and must not be
 * able to break a page at runtime by being edited while somebody is reading it.
 *
 * Russian is the reference shape and the site's default. English and Turkish are declared
 * `satisfies Copy`, so a key added to one file and forgotten in another is a build error rather
 * than `undefined` rendered as text in front of a visitor — which is exactly what a runtime
 * lookup table gives you instead.
 *
 * Both remain provisional until question Q-3 is answered, and Turkish cannot be released at all
 * until Q-17 is: Stolzl has no `Ğ ğ İ`, so a Turkish page renders tofu in the font's own
 * alphabet.
 */
export type Copy = typeof ru;

export const COPY = {
  ru,
  en: en satisfies Copy,
  tr: tr satisfies Copy,
} as const satisfies Record<SiteLang<'global'>, Copy>;

export function copyFor(lang: Lang): Copy {
  /*
   * `lang` is validated before it reaches here, but it is typed as one of four and this site
   * speaks three — so the lookup is written against the wider type and falls back to Russian.
   * A `tm` arriving from anywhere is a routing bug, and rendering Russian is better than
   * rendering nothing while somebody finds it.
   */
  const table: Partial<Record<Lang, Copy>> = COPY;
  return table[lang] ?? COPY.ru;
}

export { fill, plural } from '@charva/contracts';
export type { PluralForms } from '@charva/contracts';
