import { type Lang, LANG_NAMES, SITE_LANGS } from '@charva/contracts';
import { buttonClass, LangSwitcher, type NavItem, SiteNav } from '@charva/ui';
import { Link, useLocation } from '@tanstack/react-router';

import logoMark from '../assets/logo-mark-brown.png';
import { copyFor } from '../i18n';
import { path } from '../lib/routes';

export interface UmrahNavProps {
  lang: Lang;
}

/**
 * The sticky island — the same component as Global's, four entries instead of seven.
 *
 * Nothing about the green is written here. `SiteNav` reads its colours from the theme variables
 * scoped by `data-theme="umrah"` on `<html>`, so the island, the sheet and the focus ring are
 * this site's without a single conditional. The prototypes write both palettes as literals in
 * both files, which is how the two navigations came to differ by a pixel of padding.
 */
export function UmrahNav({ lang }: UmrahNavProps) {
  const copy = copyFor(lang);
  const { pathname } = useLocation();

  const items: NavItem[] = [
    { key: 'paket', label: copy.nav.items.paket, href: path.paket(lang) },
    { key: 'ziyarat', label: copy.nav.items.ziyarat, href: path.ziyarat(lang) },
    { key: 'maksatnama', label: copy.nav.items.maksatnama, href: path.maksatnama(lang) },
    { key: 'suratlar', label: copy.nav.items.suratlar, href: path.suratlar(lang) },
  ];

  // Longest match wins, so `/tm/ziyarat/masjid-al-haram` keeps «Ziýarat ýerleri» lit. The signup
  // page has no entry — it is reached through the call to action — and that is allowed.
  const activeKey = items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.key;

  return (
    <SiteNav
      items={items}
      {...(activeKey === undefined ? {} : { activeKey })}
      labels={{
        nav: copy.nav.label,
        openMenu: copy.nav.openMenu,
        closeMenu: copy.nav.closeMenu,
      }}
      logo={
        <Link to={path.home(lang)} aria-label={copy.nav.home} className="inline-flex items-center">
          <img src={logoMark} alt={copy.brand} width={57} height={36} className="h-9 w-auto" />
        </Link>
      }
      langSwitcher={
        <LangSwitcher
          options={SITE_LANGS.umrah.map((code) => ({
            code,
            name: LANG_NAMES[code],
            // The same page in the other language. A switcher that drops you at the root loses
            // whatever you were reading, which on a ten-day programme is most of the page.
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
        <Link to={path.yazylmak(lang)} className={buttonClass({ size: 'sm' })}>
          {copy.nav.cta}
        </Link>
      }
      renderLink={(item, props) => (
        <Link key={item.key} to={item.href} className={props.className}>
          {props.children}
        </Link>
      )}
    />
  );
}
