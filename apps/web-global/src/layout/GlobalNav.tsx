import { type Lang, LANG_NAMES, SITE_LANGS } from '@charva/contracts';
import { buttonClass, LangSwitcher, type NavItem, SiteNav } from '@charva/ui';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from '@tanstack/react-router';

import { settingsQuery } from '../api/queries';
import logoMark from '../assets/logo-mark-brown.png';
import { copyFor } from '../i18n';
import { path } from '../lib/routes';

export interface GlobalNavProps {
  lang: Lang;
  /** Floats the island over the homepage's hero photograph instead of standing above it. */
  overlay?: boolean;
}

/**
 * The sticky island.
 *
 * `SiteNav` in `packages/ui` owns everything about how it looks and behaves — the glass, the
 * collapse below `tab:`, the focus trap in the sheet, Escape. What belongs here is only what
 * this site knows: which seven entries it has, where they go, and which router draws a link.
 *
 * The active entry is derived from the URL rather than passed in by each page. A page that has
 * to remember to say which navigation item it is is a page that will one day forget, and the
 * symptom — nothing highlighted — is invisible to everyone who built it.
 */
export function GlobalNav({ lang, overlay = false }: GlobalNavProps) {
  const copy = copyFor(lang);
  const { pathname } = useLocation();
  const settings = useQuery(settingsQuery(lang));

  const items: NavItem[] = [
    { key: 'tours', label: copy.nav.items.tours, href: path.tours(lang) },
    { key: 'builder', label: copy.nav.items.builder, href: path.builder(lang) },
    { key: 'hotels', label: copy.nav.items.hotels, href: path.hotels(lang) },
    { key: 'turkmenistan', label: copy.nav.items.turkmenistan, href: path.country(lang) },
  ];

  /*
   * A section with nothing in it is not offered.
   *
   * «Видео» and «Отзывы» sat in the menu with zero rows behind them — two of seven entries
   * leading to «Здесь пока пусто». For a destination people are already unsure about, a menu
   * that promises and does not deliver costs more trust than a shorter menu would. The sitemap
   * has omitted empty sections since the SEO pass, for the same reason applied to a crawler;
   * this is the reader getting the same courtesy.
   *
   * Each entry returns by itself the day something is published there. Until the settings
   * request answers, the optional entries are simply absent — appearing is a smaller surprise
   * than vanishing, and the four that are always there carry the bar in the meantime.
   */
  const has = settings.data?.sections;

  if (has?.gallery === true) {
    items.push({ key: 'gallery', label: copy.nav.items.gallery, href: path.gallery(lang) });
  }
  if (has?.video === true) {
    items.push({ key: 'video', label: copy.nav.items.video, href: path.video(lang) });
  }
  if (has?.reviews === true) {
    items.push({ key: 'reviews', label: copy.nav.items.reviews, href: path.reviews(lang) });
  }

  /*
   * Longest match wins, so `/ru/tours/klassicheskiy-turkmenistan` keeps «Туры» lit.
   *
   * The design has no menu entry for the contact page — it is reached only through the call to
   * action — so `activeKey` is legitimately undefined there, which `SiteNav` already allows.
   */
  const activeKey = items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.key;

  return (
    <SiteNav
      items={items}
      overlay={overlay}
      {...(activeKey === undefined ? {} : { activeKey })}
      labels={{
        nav: copy.nav.label,
        openMenu: copy.nav.openMenu,
        closeMenu: copy.nav.closeMenu,
        menu: copy.nav.menu,
      }}
      logo={
        <Link to={path.home(lang)} aria-label={copy.nav.home} className="inline-flex items-center">
          <img src={logoMark} alt={copy.brand} width={57} height={36} className="h-9 w-auto" />
        </Link>
      }
      langSwitcher={
        <LangSwitcher
          options={SITE_LANGS.global.map((code) => ({
            code,
            name: LANG_NAMES[code],
            // The same page in another language, not the home page: a language switcher that
            // drops you at the root loses whatever you were reading.
            href: pathname.replace(/^\/[a-z]{2}/, `/${code}`),
          }))}
          value={lang}
          label={copy.nav.langLabel}
          renderLink={(option, props) => (
            <Link
              key={option.code}
              to={option.href}
              className={props.className}
              onClick={props.onClick}
            >
              {props.children}
            </Link>
          )}
        />
      }
      cta={
        <Link to={path.contact(lang)} className={buttonClass({ variant: 'solid', size: 'sm' })}>
          {copy.nav.cta}
        </Link>
      }
      renderLink={(item, props) => (
        <Link
          key={item.key}
          to={item.href}
          className={props.className}
          {...(props['aria-current'] === undefined ? {} : { 'aria-current': 'page' as const })}
          {...(props.onClick === undefined ? {} : { onClick: props.onClick })}
        >
          {props.children}
        </Link>
      )}
    />
  );
}
