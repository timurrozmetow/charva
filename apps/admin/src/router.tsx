import { type QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
} from '@tanstack/react-router';

import { useSession } from './auth/SessionProvider';
import { Shell } from './layout/Shell';
import { LoginPage } from './pages/LoginPage';

/**
 * Every screen, behind one gate.
 *
 * The gate is a component rather than a `beforeLoad` guard because whether there is a session
 * is not known until the refresh cookie has been exchanged — an asynchronous fact the router
 * would have to wait on for every navigation. Rendering the login screen in place of the shell
 * is simpler, has no flash of an empty dashboard, and keeps every URL bookmarkable: signing in
 * lands on the page that was asked for rather than on the root.
 */

function Gate() {
  const { state } = useSession();

  if (state === 'starting') {
    // Deliberately blank. The exchange takes one round trip on the same origin, and a spinner
    // that appears for eighty milliseconds is a flash, not information.
    return <div className="min-h-screen bg-bg" />;
  }

  return state === 'signed-in' ? <Shell /> : <LoginPage />;
}

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Gate,
  notFoundComponent: lazyRouteComponent(() => import('./pages/OverviewPage'), 'OverviewPage'),
});

const overviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: lazyRouteComponent(() => import('./pages/OverviewPage'), 'OverviewPage'),
});

const mediaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/media',
  component: lazyRouteComponent(() => import('./pages/MediaPage'), 'MediaPage'),
});

/**
 * `?site=umrah` is how the two departments reach the screens they share.
 *
 * The photograph briefs and the content blocks are one table each, spanning both sites, and the
 * whole point of the departments is that somebody maintaining the pilgrimage never has to walk
 * past the tour catalogue. Narrowing by URL rather than by a control the visitor has to find
 * also makes each department's link a real link — bookmarkable, and the same view every time.
 */
interface SiteSearch {
  site?: string;
}

function readSite(search: Record<string, unknown>): SiteSearch {
  const site = search['site'];
  return typeof site === 'string' && site !== '' ? { site } : {};
}

const slotsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/slots',
  validateSearch: readSite,
  component: lazyRouteComponent(() => import('./pages/SlotsPage'), 'SlotsPage'),
});

const leadsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/inbox/leads',
  component: lazyRouteComponent(() => import('./pages/InboxPage'), 'LeadsPage'),
});

const signupsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/inbox/signups',
  component: lazyRouteComponent(() => import('./pages/InboxPage'), 'SignupsPage'),
});

/** The search a list keeps in the URL, so a filtered view is a link somebody can send. */
interface ListSearch extends SiteSearch {
  q?: string;
  page?: number;
}

const resourceListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/data/$resource',
  validateSearch: (search: Record<string, unknown>): ListSearch => ({
    ...(typeof search['q'] === 'string' && search['q'] !== '' ? { q: search['q'] } : {}),
    ...(Number(search['page']) > 1 ? { page: Number(search['page']) } : {}),
    ...readSite(search),
  }),
  component: lazyRouteComponent(() => import('./pages/ResourceListPage'), 'ResourceListRoute'),
});

const resourceNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/data/$resource/new',
  component: lazyRouteComponent(() => import('./pages/ResourceFormPage'), 'ResourceNewRoute'),
});

const resourceEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/data/$resource/$id',
  component: lazyRouteComponent(() => import('./pages/ResourceFormPage'), 'ResourceEditRoute'),
});

const routeTree = rootRoute.addChildren([
  overviewRoute,
  mediaRoute,
  slotsRoute,
  leadsRoute,
  signupsRoute,
  // The literal `/new` must be declared before the `$id` parameter, or «new» is read as an id.
  resourceNewRoute,
  resourceListRoute,
  resourceEditRoute,
]);

export function buildRouter(queryClient: QueryClient) {
  return createRouter({ routeTree, context: { queryClient }, defaultPreload: 'intent' });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof buildRouter>;
  }
}

export { Outlet };
