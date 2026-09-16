import {
  HERO_SCRIM_DIRECTION,
  heroScrimCss,
  type Lang,
  SCRIM_RGB,
  SITE_BRAND,
  type Site,
} from '@charva/contracts';

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
 * The hero photograph, as it appears behind the loading spinner.
 *
 * Measured on a throttled phone: the picture has finished downloading at about two seconds, and
 * the visitor first sees it at about three and a third — because until React has mounted the
 * whole homepage the splash is an opaque cream rectangle over everything. One and a third
 * seconds of a spinner in front of a photograph that is already in memory.
 *
 * It is the same file the head preloads, from the same `heroImage()`, so this costs no request:
 * the preload started it before the stylesheet was parsed, and this element is what it was
 * started for. Painting it *under* the splash instead would move the largest-paint number and
 * show the visitor nothing, which is the opposite of the point.
 *
 * Inline styles and literal colours, for the reason D-125 gives about the splash itself: the
 * token stylesheet is one of the files being waited for, so a class or a `var(--c-*)` would
 * resolve to nothing during the only moment this element exists.
 *
 * `alt=""` and `aria-hidden`: the page's real hero carries the description a moment later, and
 * a screen reader that announced this one would announce it twice. The scrim matches the one
 * the real hero lays under its light text, so the 360ms fade is between two near-identical
 * pictures rather than a step change in brightness.
 */
export function renderBootImage(
  site: Site,
  image: {
    url: string;
    srcSet: string | null;
    lqip: string | null;
  } | null,
): string {
  if (image === null) return '';

  /*
   * No fade in, and that is a correction rather than a simplification.
   *
   * It began as `opacity:0` with an `onload` that set it to one, on the theory that a
   * half-decoded photograph appearing in strips reads as a fault. WebP has no progressive mode —
   * it paints whole or not at all — so the guard protected against something that cannot happen,
   * and it cost the thing the change exists for: Chrome does not accept an element with zero
   * opacity as a largest-contentful-paint candidate, so the picture the visitor could see at 1.9
   * seconds was still being reported at 3.2. Measured both ways.
   *
   * Removing it also removes the only inline event handler on these pages, which is worth having
   * on the day a content security policy is written.
   */
  const cover = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover';

  /*
   * The hero's own overlay, not an approximation of it.
   *
   * Without it the splash showed a bright desert and the page a dark one, and the 360ms handover
   * between them was a step change in brightness on the largest element either site has. The
   * gradient comes from `heroScrimCss` in contracts — the same function the stylesheet's
   * `bg-scrim-hero` is built from — with this site's base substituted for the CSS variable,
   * because no stylesheet has loaded at the moment this element exists.
   */
  const scrim = heroScrimCss(SCRIM_RGB[site], HERO_SCRIM_DIRECTION[site]);

  /*
   * The blurred thumbnail underneath, and it is the half that actually works.
   *
   * Measured on a throttled phone: the full-size hero is on screen for 597ms at one device pixel
   * per CSS pixel, **18ms at two, and never at three** — at three it is four times the bytes and
   * React has taken the splash away before it lands. So on the phones most of this audience
   * carries, the photograph in the splash was a feature nobody would ever see.
   *
   * The thumbnail is about a hundred characters of data URI already stored on the media row and
   * already sent to the browser for the page's own use. Inline, it costs no request and paints
   * with the first frame, on every device. `blur` because ten pixels across scaled to a phone is
   * a mosaic otherwise, and `scale` because a blur of that radius leaves a soft edge that would
   * otherwise show as a lighter band around the screen.
   */
  const backdrop =
    image.lqip === null
      ? ''
      : `<span aria-hidden="true" style="position:absolute;inset:0;overflow:hidden">` +
        `<span style="position:absolute;inset:0;background-image:url(${escapeHtml(image.lqip)});` +
        `background-size:cover;background-position:center;filter:blur(24px);transform:scale(1.12)">` +
        `</span></span>`;

  return (
    backdrop +
    `<img src="${escapeHtml(image.url)}"` +
    (image.srcSet === null ? '' : ` srcset="${escapeHtml(image.srcSet)}" sizes="100vw"`) +
    ` alt="" aria-hidden="true" decoding="async" fetchpriority="high"` +
    ` style="${cover}">` +
    `<span aria-hidden="true" style="position:absolute;inset:0;background:${escapeHtml(scrim)}"></span>`
  );
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
