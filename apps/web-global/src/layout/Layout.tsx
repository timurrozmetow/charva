import { type Lang } from '@charva/contracts';
import { useQuery } from '@tanstack/react-query';
import { Outlet, useLocation } from '@tanstack/react-router';

import { settingsQuery } from '../api/queries';
import { path } from '../lib/routes';

import { GlobalFooter } from './GlobalFooter';
import { GlobalNav } from './GlobalNav';

export interface LayoutProps {
  lang: Lang;
}

/**
 * Navigation, page, footer.
 *
 * `main` carries the skip link's target and the page's own heading; the nav and the footer are
 * landmarks in their own right, so a screen-reader user can jump past seven menu items instead
 * of hearing them on every page.
 */
export function Layout({ lang }: LayoutProps) {
  // Shared by the footer and, later, by the contact page. One request per language for both.
  const { data: settings } = useQuery(settingsQuery(lang));
  const { pathname } = useLocation();

  /*
   * The homepage is the one route whose first element is a full-bleed photograph, so it is the
   * one route the navigation floats over rather than standing above. Everywhere else the first
   * thing on the page is a breadcrumb on cream, and an island hovering over that would be a
   * pill floating in white space.
   *
   * Decided here rather than by the page, because the nav is the layout's and a page that has
   * to remember to announce what it looks like underneath will one day forget.
   */
  const overlay = pathname === path.home(lang);

  return (
    <div className="relative flex min-h-dvh flex-col bg-bg">
      <GlobalNav lang={lang} overlay={overlay} />

      <main id="content" className="flex-1">
        <Outlet />
      </main>

      <GlobalFooter lang={lang} settings={settings ?? null} />
    </div>
  );
}
