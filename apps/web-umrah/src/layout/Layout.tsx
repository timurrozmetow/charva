import { type Lang } from '@charva/contracts';
import { TopProgress } from '@charva/ui';
import { useIsFetching, useQuery } from '@tanstack/react-query';
import { Outlet, useLocation, useRouterState } from '@tanstack/react-router';

import { settingsQuery } from '../api/queries';
import { path } from '../lib/routes';

import { UmrahFooter } from './UmrahFooter';
import { UmrahNav } from './UmrahNav';

export interface LayoutProps {
  lang: Lang;
}

/**
 * Navigation, page, footer.
 *
 * `main` carries the skip link's target and the page's own heading; the nav and the footer are
 * landmarks in their own right, so a screen-reader user can jump past four menu items rather
 * than hearing them on every page.
 */
export function Layout({ lang }: LayoutProps) {
  const { data: settings } = useQuery(settingsQuery(lang));
  const { pathname } = useLocation();

  // The homepage is the one route that opens on a full-bleed photograph, so it is the one the
  // island floats over. See the same note on Global's layout.
  const overlay = pathname === path.home(lang);

  // Both halves of the wait, as on Global: the router resolving a route, and a rendered page
  // filling itself in.
  const navigating = useRouterState({ select: (state) => state.status === 'pending' });
  const fetching = useIsFetching() > 0;

  return (
    <div className="relative flex min-h-dvh flex-col bg-bg">
      <TopProgress active={navigating || fetching} />
      <UmrahNav lang={lang} overlay={overlay} />

      <main id="content" className="flex-1">
        {/* Keyed on the path, and keyed here rather than on `main` so the skip link's target
            survives a navigation. */}
        <div key={pathname} className="animate-page-in">
          <Outlet />
        </div>
      </main>

      <UmrahFooter lang={lang} settings={settings ?? null} />
    </div>
  );
}
