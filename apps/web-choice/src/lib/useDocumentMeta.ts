import {
  applyDocumentHead,
  bcp47,
  hreflangSet,
  type Lang,
  routeMeta,
  type SiteRoute,
} from '@charva/contracts';
import { useEffect } from 'react';

const SITE = 'choice';

/**
 * Keeps `<html lang>`, the title, the description and the link set in step with the page.
 *
 * `lang` on the root element is the one that is not cosmetic: it decides which voice a screen
 * reader uses, and a Turkmen page announced by a Russian synthesiser is unintelligible rather
 * than merely wrong. The prototype's chooser switches nothing at all — its language menu changes
 * only its own label.
 *
 * The strings come from `@charva/contracts` rather than from this app's copy file, because the
 * API renders the same head into the shell for crawlers and link previews (decision D-4). One
 * source, two renderers; two copies of a title is how the server's version and the browser's
 * come to disagree without anybody noticing.
 *
 * **The whole set is replaced, not added to** — D-168, which Global and Umrah adopted and this
 * app did not. The old version removed only links carrying its own `data-charva` mark and
 * appended new ones beside the shell's, so the chooser shipped **eight** `hreflang` links on
 * every page: the server's four and the app's four, measured on the live site. Google's rule for
 * a repeated `rel` is to ignore the lot and choose a page itself. The mark is gone along with the
 * code that needed it — what makes a link the canonical one is its `rel`, not who wrote it.
 *
 * The canonical is new here: the chooser wrote none at all while the shell wrote one, so the two
 * ends disagreed about whether the page even had one. It is the address being rendered, which on
 * the chooser's own page is `/<lang>` and on the 404 is whatever was typed — the same value the
 * shell already declares, so a crawler sees one answer from both.
 */
export function useDocumentMeta(lang: Lang, route: SiteRoute<'choice'> = 'home'): void {
  const { title, description } = routeMeta(SITE, route, lang);

  useEffect(() => {
    applyDocumentHead({
      // BCP 47, not the internal key: Turkmen is `tk` to a parser and to a screen reader.
      lang: bcp47(lang),
      title,
      description,
      // The path without the query: `/ru?utm_source=…` is the chooser, not another page.
      canonical: new URL(route === 'home' ? `/${lang}` : location.pathname, location.origin).href,
      alternates: hreflangSet(SITE).map(({ hreflang, lang: target }) => ({
        hreflang,
        href: new URL(`/${target}`, location.origin).toString(),
      })),
    });
  }, [lang, route, title, description]);
}
