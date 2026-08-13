import { type Lang, type PluralForms } from '@charva/contracts';

import en from './en.json';
import ru from './ru.json';
import tm from './tm.json';
import tr from './tr.json';

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
 * The English and Turkish copy is provisional: it is a working translation of twenty-odd
 * strings so the language chooser does something, not the reviewed copy question Q-3 asks for.
 * Turkish additionally cannot be released at all until Q-17 is answered — Stolzl has no `Ğ ğ İ`.
 */
export type Copy = typeof ru;

export const COPY = {
  ru,
  en: en satisfies Copy,
  tr: tr satisfies Copy,
  tm: tm satisfies Copy,
} as const satisfies Record<Lang, Copy>;

/**
 * Plural forms and placeholder filling live in `@charva/contracts`.
 *
 * Both sites need them and neither owns them: the rules are about languages, not about a page.
 * Re-exported here so a component imports one module rather than two.
 */
export { fill, plural } from '@charva/contracts';

export type { PluralForms };
