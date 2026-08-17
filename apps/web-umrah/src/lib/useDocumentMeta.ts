import { contentMeta, hreflangSet, type Lang, routeMeta, type SiteRoute } from '@charva/contracts';
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
 * The `hreflang` set is rewritten on every navigation rather than patched, because it is two
 * links and a default and reconciling them one at a time is more code than replacing them.
 */
export function useDocumentMeta({ route, pathAfterLang, content }: DocumentMeta, lang: Lang): void {
  const section = routeMeta(SITE, route, lang);
  const { title, description } =
    content === undefined ? section : withFallback(contentMeta(SITE, content), section.description);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = title;
    setMeta('description', description);

    for (const stale of document.querySelectorAll('link[data-charva]')) stale.remove();

    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = new URL(`/${lang}${pathAfterLang}`, location.origin).toString();
    canonical.dataset['charva'] = '';
    document.head.append(canonical);

    for (const { hreflang, lang: target } of hreflangSet(SITE)) {
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = hreflang;
      link.href = new URL(`/${target}${pathAfterLang}`, location.origin).toString();
      link.dataset['charva'] = '';
      document.head.append(link);
    }
  }, [lang, title, description, pathAfterLang]);
}

/** A row with no summary of its own still needs a description; the section's is a true one. */
function withFallback(meta: { title: string; description: string }, fallback: string) {
  return meta.description === '' ? { ...meta, description: fallback } : meta;
}

function setMeta(name: string, content: string): void {
  let tag = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  tag ??= document.head.appendChild(Object.assign(document.createElement('meta'), { name }));
  tag.content = content;
}
