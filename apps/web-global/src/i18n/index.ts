import { type Lang, type SiteLang } from '@charva/contracts';

import en from './en.json';
import ru from './ru.json';

/**
 * Interface copy, as versioned files in the repository — decision D-23.
 *
 * Content lives in the database and is edited without a deploy; the words *around* the content
 * change together with the markup they sit in, are reviewed together with it, and must not be
 * able to break a page at runtime by being edited while somebody is reading it.
 *
 * Russian is the reference shape and the site's default. English is declared `satisfies Copy`,
 * so a key added to one file and forgotten in the other is a build error rather than `undefined`
 * rendered as text in front of a visitor — which is exactly what a runtime lookup table gives
 * you instead.
 *
 * Both remain provisional until question Q-3 is answered.
 *
 * **Turkish is kept and is not imported here.** `SITE_LANGS.global` dropped it — Stolzl has no
 * `Ğ ğ İ`, so every second Turkish word came out in two typefaces (Q-17) — and `/tr/…` has
 * answered with a redirect ever since. The file stayed in this table anyway, which meant fifteen
 * kilobytes of a language nothing can request travelled to every visitor in the entry bundle,
 * measured against a total of 372. Retiring it is supposed to cost nothing.
 *
 * It is still four hundred strings of real work and it still has to stay correct for the day the
 * foundry supplies a fuller cut, so the guard moved rather than went: `copy.test.ts` imports the
 * file directly and holds it to the same shape, placeholders and plural rules as the two that
 * ship. That is a stronger check than this file ever applied — `satisfies` proves the shape and
 * says nothing about whether `{count}` survived translation.
 */
export type Copy = typeof ru;

export const COPY = {
  ru,
  en: en satisfies Copy,
} as const satisfies Record<SiteLang<'global'>, Copy> & Partial<Record<Lang, Copy>>;

export function copyFor(lang: Lang): Copy {
  /*
   * `lang` is validated before it reaches here, but it is typed as one of four and this site
   * speaks two — so the lookup is written against the wider type and falls back to Russian.
   * A `tm` arriving from anywhere is a routing bug, and rendering Russian is better than
   * rendering nothing while somebody finds it.
   */
  const table: Partial<Record<Lang, Copy>> = COPY;
  return table[lang] ?? COPY.ru;
}

export { fill, plural } from '@charva/contracts';
export type { PluralForms } from '@charva/contracts';
