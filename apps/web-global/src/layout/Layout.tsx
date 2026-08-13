import { type Lang } from '@charva/contracts';
import { useQuery } from '@tanstack/react-query';
import { Outlet } from '@tanstack/react-router';

import { settingsQuery } from '../api/queries';

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

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <GlobalNav lang={lang} />

      <main id="content" className="flex-1">
        <Outlet />
      </main>

      <GlobalFooter lang={lang} settings={settings ?? null} />
    </div>
  );
}
