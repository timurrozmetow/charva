import { type Lang, SITE_LANGS } from '@charva/contracts';
import { useEffect } from 'react';

export interface DocumentMeta {
  title: string;
  description: string;
  /** Path without the language prefix — `/tours`, `/tours/klassicheskiy-turkmenistan`. */
  pathAfterLang: string;
}

/**
 * Keeps the head in step with the route.
 *
 * `lang` on the root element is the one that is not cosmetic: it decides which voice a screen
 * reader uses, and the prototypes' language menus change nothing at all — not the content, not
 * this attribute.
 *
 * The `hreflang` set is rewritten on every navigation rather than patched, because it is three
 * links and a default and reconciling them one at a time is more code than replacing them.
 *
 * This is the honest half of the job. Crawlers and link previews need these tags in the HTML
 * before any JavaScript runs, which a client-rendered page cannot do — phase 8 renders the head
 * from the API into the SPA shell for exactly that reason (decision D-4). What is here keeps
 * the three translations discoverable from one another and the tab title correct, which is what
 * a browser can honestly deliver on its own.
 */
export function useDocumentMeta(
  { title, description, pathAfterLang }: DocumentMeta,
  lang: Lang,
): void {
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

    for (const code of [...SITE_LANGS.global, 'x-default'] as const) {
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = code;
      // `x-default` points at Russian: it is this site's default language, not a fourth one.
      link.href = new URL(
        `/${code === 'x-default' ? 'ru' : code}${pathAfterLang}`,
        location.origin,
      ).toString();
      link.dataset['charva'] = '';
      document.head.append(link);
    }
  }, [lang, title, description, pathAfterLang]);
}

function setMeta(name: string, content: string): void {
  let tag = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  tag ??= document.head.appendChild(Object.assign(document.createElement('meta'), { name }));
  tag.content = content;
}
