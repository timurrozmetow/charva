import { type Lang, type PluralForms, type SiteLang } from '@charva/contracts';

import en from './en.json';
import ru from './ru.json';
import tm from './tm.json';

/**
 * Interface copy, as versioned files in the repository — decision D-23.
 *
 * The handoff's README asks for a «Переводы» screen in the admin with a table of keys. Interface
 * copy changes together with the markup it sits in, is reviewed together with it, and must not
 * be able to break a page at runtime by being edited while somebody is looking at it. Content
 * lives in the database; the words around the content live here.
 *
 * Russian is the reference shape. The other three are declared `satisfies Copy`, so a key added
 * to one file and forgotten in another is a type error at build time rather than an `undefined`
 * rendered as text — the failure mode a runtime lookup table has and this does not.
 *
 * The English copy is provisional: a working translation of twenty-odd strings so the language
 * chooser does something, not the reviewed copy question Q-3 asks for.
 *
 * **Turkish is kept and is not imported here.** `SITE_LANGS.choice` dropped it with Global's —
 * the chooser's Turkish existed to hand a Turkish speaker to Global's Turkish, and Umrah is
 * `tm`/`ru` — so the switcher lists three and `/tr/…` answers with a redirect. The table used to
 * name all four anyway, on the reasoning that a stricter promise keeps the file ready; the cost
 * of that promise was shipping a language nothing can request to every visitor. The same was
 * true of Global, where it was fifteen kilobytes rather than one and a half.
 *
 * The file stays, and so does the guard: `copy.test.ts` imports it directly and holds it to the
 * same shape, placeholders and chip counts as the three that ship. One entry in `SITE_LANGS`
 * still serves it again.
 */
export type Copy = typeof ru;

export const COPY = {
  ru,
  en: en satisfies Copy,
  tm: tm satisfies Copy,
} as const satisfies Record<SiteLang<'choice'>, Copy>;

/**
 * The copy for a language, narrowed from the four the project has to the three this site speaks.
 *
 * The four components that need copy used to index `COPY` directly, which type-checked only
 * while the table promised every language of the project. It no longer does — the retired one is
 * not shipped — so the fallback has to be written down somewhere, and one function is the place.
 * Global and Umrah have had exactly this for the same reason; the chooser was the odd one out.
 *
 * A `tr` reaching here is a routing bug (`/tr/…` redirects before it can), and rendering Russian
 * beats rendering nothing while somebody finds it.
 */
export function copyFor(lang: Lang): Copy {
  const table: Partial<Record<Lang, Copy>> = COPY;
  return table[lang] ?? COPY.ru;
}

/**
 * Plural forms and placeholder filling live in `@charva/contracts`.
 *
 * Both sites need them and neither owns them: the rules are about languages, not about a page.
 * Re-exported here so a component imports one module rather than two.
 */
export { fill, plural } from '@charva/contracts';

export type { PluralForms };
