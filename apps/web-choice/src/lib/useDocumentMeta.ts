import { bcp47, hreflangSet, type Lang, routeMeta } from '@charva/contracts';
import { useEffect } from 'react';

const SITE = 'choice';

/**
 * Keeps `<html lang>`, the title and the description in step with the language.
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
 */
export function useDocumentMeta(lang: Lang): void {
  const { title, description } = routeMeta(SITE, 'home', lang);

  useEffect(() => {
    // BCP 47, not the internal key: Turkmen is `tk` to a parser and to a screen reader.
    document.documentElement.lang = bcp47(lang);
    document.title = title;

    setMeta('description', description);

    // Replaced wholesale rather than patched: the set is four links and a default, and
    // reconciling them one by one is more code than rewriting them.
    for (const stale of document.querySelectorAll('link[rel="alternate"][data-charva]')) {
      stale.remove();
    }
    for (const { hreflang, lang: target } of hreflangSet(SITE)) {
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = hreflang;
      link.href = new URL(`/${target}`, location.origin).toString();
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
