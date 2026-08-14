import { type Lang, type SiteLang } from '@charva/contracts';

import ru from './ru.json';
import tm from './tm.json';

/**
 * Interface copy, as versioned files in the repository — decision D-23.
 *
 * **Turkmen is the reference shape here**, not Russian. On Global the default language defines
 * the type and the others are checked against it; this site's default is Turkmen, so `Copy` is
 * `typeof tm` and a key added to the Russian file and forgotten in the Turkmen one is a build
 * error rather than `undefined` rendered at a pilgrim.
 *
 * That asymmetry is the point of the whole file. The handoff's Turkmen pages carry Russian in
 * four places — the ziyarat page's H1 «Куда мы пойдём», a duplicated H2, a sentence in the call
 * to action and the signup form's `Bellik / Комментарий` label — and every one of them is there
 * because Russian was the language the page was written in. Here Russian cannot lead: it is
 * declared `satisfies Copy`, and `no-russian-in-turkmen.test.ts` checks that no source file
 * outside `ru.json` contains Cyrillic at all.
 *
 * Both files are provisional until question Q-3 is answered by a native speaker.
 */
export type Copy = typeof tm;

export const COPY = {
  tm,
  ru: ru satisfies Copy,
} as const satisfies Record<SiteLang<'umrah'>, Copy>;

export function copyFor(lang: Lang): Copy {
  /*
   * `lang` is validated before it reaches here, but it is typed as one of four and this site
   * speaks two. An `en` arriving from anywhere is a routing bug, and Turkmen is what this
   * site's audience reads — so that is the fallback.
   */
  const table: Partial<Record<Lang, Copy>> = COPY;
  return table[lang] ?? COPY.tm;
}

export { fill, plural } from '@charva/contracts';
export type { PluralForms } from '@charva/contracts';
