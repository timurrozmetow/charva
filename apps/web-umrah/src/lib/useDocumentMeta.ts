import {
  applyDocumentHead,
  bcp47,
  contentMeta,
  hreflangSet,
  type Lang,
  routeMeta,
  type SiteRoute,
} from '@charva/contracts';
import { useEffect } from 'react';

const SITE = 'umrah';

export interface DocumentMeta {
  /** Which of the site's sections this page belongs to. Its head copy lives in contracts. */
  route: SiteRoute<typeof SITE>;
  /** Path without the language prefix — `/paket`, `/ziyarat/masjid-al-haram`. */
  pathAfterLang: string;
  /**
   * Present on a detail page, once the row has arrived.
   *
   * Absent while it is loading, and absent on a 404 — in both cases the section's own title is
   * the honest thing to show, rather than an empty tab or the word «undefined».
   */
  content?: { name: string; summary?: string | null | undefined } | undefined;
}

/**
 * Keeps the head in step with the route.
 *
 * `lang` on the root element is the one that is not cosmetic: it decides which voice a screen
 * reader uses, and the prototypes' language menus change nothing at all — not the content, not
 * this attribute.
 *
 * The strings come from `@charva/contracts`, not from this app's copy file, because the API
 * renders the same head into the shell before any of this runs (decision D-4). A crawler and a
 * Telegram card read the server's version; a visitor navigating inside the app reads this one.
 * Two copies of one title is how those two come to disagree, silently, for whichever half of
 * the audience nobody happens to be testing as.
 *
 * Which tags are rewritten, which are replaced wholesale and which belong to the server is the
 * subject of `applyDocumentHead` — this hook only decides what they should say.
 */
export function useDocumentMeta({ route, pathAfterLang, content }: DocumentMeta, lang: Lang): void {
  const section = routeMeta(SITE, route, lang);
  const { title, description } =
    content === undefined ? section : withFallback(contentMeta(SITE, content), section.description);

  useEffect(() => {
    const href = (target: Lang) =>
      new URL(`/${target}${pathAfterLang}`, location.origin).toString();

    applyDocumentHead({
      // BCP 47, not the internal key: Turkmen is `tk` to a parser and to a screen reader.
      lang: bcp47(lang),
      title,
      description,
      canonical: href(lang),
      alternates: hreflangSet(SITE).map(({ hreflang, lang: target }) => ({
        hreflang,
        href: href(target),
      })),
    });
  }, [lang, title, description, pathAfterLang]);
}

/** A row with no summary of its own still needs a description; the section's is a true one. */
function withFallback(meta: { title: string; description: string }, fallback: string) {
  return meta.description === '' ? { ...meta, description: fallback } : meta;
}
