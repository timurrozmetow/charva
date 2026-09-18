/**
 * Writing the head from the application, over the one the shell has already written.
 *
 * The API renders a complete head into the HTML before any of this runs (D-4, D-85) and the
 * application then keeps it in step as the visitor navigates. The trap is that «keep in step» is
 * not «add»: a link the shell wrote carries no marker of ours, so appending ours beside it leaves
 * the document with two canonicals and two sets of `hreflang` — which is exactly what it did, on
 * every page of both public sites, from the day the shell was deployed. Google's rule for more
 * than one canonical element is to ignore all of them and pick the page's canonical itself; that
 * is the same sentence Search Console prints when it calls a page a copy of another.
 *
 * So this owns the whole set. Every canonical and every `hreflang` in the document is removed,
 * whoever wrote it, and replaced — rather than patched one at a time, which for a handful of
 * links is more code than rebuilding them.
 *
 * Two things in the head are deliberately left alone:
 *
 * The title and the description were never duplicated, for two different reasons — the shell
 * strips the template's own title before injecting its own, and the description is patched in
 * place here rather than appended.
 *
 * The Open Graph card is the server's and stays the server's. Nothing that reads it runs
 * JavaScript: Telegram, WhatsApp and every other unfurler fetch the URL and parse the bytes, so
 * what they see is always the shell's card for the address they asked about. The application
 * cannot improve on it and must not half-edit it — it has no way to know the page's first
 * photograph, and a card whose title has moved on while its image has not is worse than one that
 * is simply the server's, whole.
 */

/** Everything in the head that follows the route. */
export interface DocumentHead {
  /** BCP 47 for `<html lang>` — `tk` for Turkmen, never the internal `tm` key (D-130). */
  lang: string;
  title: string;
  description: string;
  /** Absolute, and the address of this page in this language. */
  canonical: string;
  /** Every language of this page, `x-default` included. */
  alternates: { hreflang: string; href: string }[];
}

export function applyDocumentHead(head: DocumentHead): void {
  document.documentElement.lang = head.lang;
  document.title = head.title;
  setMeta('description', head.description);

  for (const stale of document.head.querySelectorAll(
    'link[rel="canonical"], link[rel="alternate"][hreflang]',
  )) {
    stale.remove();
  }

  document.head.append(alternateLink('canonical', head.canonical));
  for (const { hreflang, href } of head.alternates) {
    document.head.append(alternateLink('alternate', href, hreflang));
  }
}

/** `data-charva` says who wrote the link. Nothing selects on it; the tests read it. */
function alternateLink(rel: string, href: string, hreflang?: string): HTMLLinkElement {
  const link = document.createElement('link');
  link.rel = rel;
  link.href = href;
  if (hreflang !== undefined) link.hreflang = hreflang;
  link.dataset['charva'] = '';
  return link;
}

function setMeta(name: string, content: string): void {
  let tag = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  tag ??= document.head.appendChild(Object.assign(document.createElement('meta'), { name }));
  tag.content = content;
}
