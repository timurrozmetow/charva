import { SITE_BRAND, type Lang, type Site } from '@charva/contracts';

import { escapeHtml } from './html';

export interface FallbackLink {
  /** Site-relative, language prefix included — `/ru/tours`. */
  href: string;
  label: string;
  /** The page being rendered. It is listed, but not as a link to itself. */
  current: boolean;
}

export interface FallbackInput {
  site: Site;
  lang: Lang;
  /** The page's own `<title>`, already resolved — the same string the head carries. */
  title: string;
  description: string;
  links: readonly FallbackLink[];
  contacts: { phone: string; email: string };
}

/**
 * What a reader who runs no JavaScript gets, and it is not a second copy of the site.
 *
 * The head has been complete since phase 8 — title, description, canonical, `hreflang`, the
 * card, the structured data — and the body was `<div id="root"></div>`, eighty-six bytes. For
 * Google that is survivable: it renders JavaScript, and the structured data tells it what the
 * page is. For everything else it is not. Yandex renders far less reliably and is where a
 * Russian-language visitor from this region actually searches; and *every* crawler that skips
 * the render step sees a site of twenty pages in which no page links to any other. The sitemap
 * supplies the addresses, but a sitemap is a list, not a link graph: nothing carries anchor
 * text, nothing says which pages this site considers important, and nothing connects them.
 *
 * So this is deliberately the smallest thing that fixes that, and the boundary is worth stating
 * because the next person will want to grow it. **Every string here already exists somewhere
 * else and is read from there**: the heading and the paragraph are the head's own title and
 * description (`seo.ts`, decision D-84), the links are the sitemap's page list with the
 * empty-section filter already applied (D-144), their anchor text is each page's own title, and
 * the contacts are the `settings` row the footer renders. Nothing is written for this file, so
 * nothing here can drift from the page it describes.
 *
 * It is **not** server-side rendering and must not become it. D-4 weighed full SSR for sixteen
 * near-static routes and turned it down; rendering the tour list here would mean a second
 * implementation of every page, in another language, kept in step by hand. A crawler that wants
 * the tours follows the link to the tours.
 *
 * It goes inside `#root`, so React removes it: `createRoot().render()` clears the container on
 * first mount, which is the same mechanism that lets a spinner live there. Nothing has to
 * remember to take it away, and there is no third element for three `main.tsx` files to know
 * about. Until then it sits under the boot splash, which covers the page anyway — so the only
 * readers who ever see it are the ones it is for: a crawler, a text browser, and the visitor
 * whose script never arrived.
 */
export function renderFallback(input: FallbackInput): string {
  const { title, description, links, contacts } = input;

  // The page being rendered is left out rather than listed unlinked: the `<h1>` directly above
  // is the same string, and a self-link carries nothing a crawler can follow.
  const items = links
    .filter((link) => !link.current)
    .map((link) => `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`);

  const contactLines: string[] = [];
  if (contacts.phone !== '') {
    // `tel:` wants the number without the spaces a human reads it with.
    const dial = contacts.phone.replace(/[^\d+]/g, '');
    contactLines.push(`<a href="tel:${escapeHtml(dial)}">${escapeHtml(contacts.phone)}</a>`);
  }
  if (contacts.email !== '') {
    contactLines.push(
      `<a href="mailto:${escapeHtml(contacts.email)}">${escapeHtml(contacts.email)}</a>`,
    );
  }

  return [
    // The brand comes off the heading for the same reason it comes off a link: «Отели
    // Туркменистана — Charva Travel» is a tab label, and the page's real `<h1>` does not say
    // it. `og:site_name` in the head is where a reader is told whose site this is.
    `<h1>${escapeHtml(anchorText(title, input.site))}</h1>`,
    `<p>${escapeHtml(description)}</p>`,
    items.length === 0 ? '' : `<ul>${items.join('')}</ul>`,
    contactLines.length === 0 ? '' : `<p>${contactLines.join(' ')}</p>`,
  ]
    .filter((part) => part !== '')
    .join('');
}

/**
 * A page's title, trimmed of the brand, for use as the text of a link to it.
 *
 * `seo.ts` writes «Готовые туры по Туркменистану — Charva Travel», which is right for a tab and
 * a search result and wrong for an anchor: twenty links each ending in the same three words say
 * less than twenty links that do not. Only a *trailing* brand is removed — the chooser's own
 * title begins with it («Charva Travel — туры по Туркменистану и умра»), and there the brand is
 * the subject rather than a signature.
 */
export function anchorText(title: string, site: Site): string {
  const brand = SITE_BRAND[site];
  const suffix = ` — ${brand}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length) : title;
}
