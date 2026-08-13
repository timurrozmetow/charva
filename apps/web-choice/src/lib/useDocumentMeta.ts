import { type Lang, SITE_LANGS } from '@charva/contracts';
import { useEffect } from 'react';

/**
 * Keeps `<html lang>`, the title and the description in step with the route.
 *
 * `lang` on the root element is the one that is not cosmetic: it decides which voice a screen
 * reader uses, and a Turkmen page announced by a Russian synthesiser is unintelligible rather
 * than merely wrong. The prototype's chooser switches nothing at all — its language menu changes
 * only its own label.
 *
 * `hreflang` links are written here too. Phase 8 renders the whole head from the API for
 * crawlers (decision D-4); until then these keep the four translations discoverable from one
 * another, which is the part a client-rendered page can do honestly.
 */
export function useDocumentMeta(lang: Lang, title: string, description: string): void {
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = title;

    setMeta('description', description);

    // Replaced wholesale rather than patched: the set is four links and a default, and
    // reconciling them one by one is more code than rewriting them.
    for (const stale of document.querySelectorAll('link[rel="alternate"][data-charva]')) {
      stale.remove();
    }
    for (const code of [...SITE_LANGS.choice, 'x-default'] as const) {
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = code;
      link.href = new URL(`/${code === 'x-default' ? 'ru' : code}`, location.origin).toString();
      link.dataset['charva'] = '';
      document.head.append(link);
    }
  }, [lang, title, description]);
}

function setMeta(name: string, content: string): void {
  let tag = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  tag ??= document.head.appendChild(Object.assign(document.createElement('meta'), { name }));
  tag.content = content;
}
