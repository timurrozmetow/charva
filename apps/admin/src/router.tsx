import { type QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  useParams,
} from '@tanstack/react-router';

import { useSession } from './auth/SessionProvider';
import { Shell } from './layout/Shell';
import { LeadsPage, SignupsPage } from './pages/InboxPage';
import { LoginPage } from './pages/LoginPage';
import { MediaPage } from './pages/MediaPage';
import { OverviewPage } from './pages/OverviewPage';
import { ResourceFormPage } from './pages/ResourceFormPage';
import { ResourceListPage } from './pages/ResourceListPage';
import { SlotsPage } from './pages/SlotsPage';

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
  notFoundComponent: () => <OverviewPage />,
});

const overviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: OverviewPage,
});

const mediaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/media',
  component: MediaPage,
});

const slotsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/slots',
  component: SlotsPage,
});

const leadsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/inbox/leads',
  component: LeadsPage,
});

const signupsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/inbox/signups',
  component: SignupsPage,
});

/** The search a list keeps in the URL, so a filtered view is a link somebody can send. */
interface ListSearch {
  q?: string;
  page?: number;
}

const resourceListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/data/$resource',
  validateSearch: (search: Record<string, unknown>): ListSearch => ({
    ...(typeof search['q'] === 'string' && search['q'] !== '' ? { q: search['q'] } : {}),
    ...(Number(search['page']) > 1 ? { page: Number(search['page']) } : {}),
  }),
  component: ResourceList,
});

const resourceNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/data/$resource/new',
  component: ResourceNew,
});

const resourceEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/data/$resource/$id',
  component: ResourceEdit,
});

/*
 * Named functions, not inline arrows.
 *
 * `useParams` is a hook, and a hook inside `component: () => …` sits in a function React's
 * rules do not recognise as a component — decision D-63, learned in phase 5.
 */
function ResourceList() {
  const { resource } = useParams({ from: '/data/$resource' });
  return <ResourceListPage resource={resource} />;
}

function ResourceNew() {
  const { resource } = useParams({ from: '/data/$resource/new' });
  return <ResourceFormPage resource={resource} id={null} />;
}

function ResourceEdit() {
  const { resource, id } = useParams({ from: '/data/$resource/$id' });
  return <ResourceFormPage resource={resource} id={Number(id)} />;
}

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
