import { type QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  redirect,
} from '@tanstack/react-router';

import {
  groupsQuery,
  homeQuery,
  packageQuery,
  programQuery,
  settingsQuery,
  tripQuery,
  ziyaratPlaceQuery,
  ziyaratQuery,
} from './api/queries';
import { Layout } from './layout/Layout';
import { bestLang, isUmrahLang } from './lib/lang';
import { useLang } from './lib/routeParams';
import { NotFoundPage } from './pages/NotFoundPage';

/**
 * Every URL carries its language, and the browser's preference decides only where `/` goes.
 *
 * Turkmen is the default here, Russian on Global — which is the whole reason `SITE_LANGS` is a
 * per-site tuple rather than one shared list.
 */

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Outlet,
  notFoundComponent: () => <NotFoundPage lang="tm" />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    // `redirect()` returns a router signal rather than an Error; throwing it is how a loader
    // navigates, and wrapping it would stop the router recognising it.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({
      to: '/$lang',
      params: { lang: bestLang(navigator.languages) },
      replace: true,
    });
  },
});

const langRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$lang',
  beforeLoad: ({ params }) => {
    if (!isUmrahLang(params.lang)) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({
        to: '/$lang',
        params: { lang: bestLang(navigator.languages) },
        replace: true,
      });
    }
  },
  loader: ({ context, params }) => {
    if (!isUmrahLang(params.lang)) return;
    // The footer needs contacts on every page, and every page of this site shows the departure
    // one way or another — the badge, the countdown, the dates, the seat count.
    void context.queryClient.prefetchQuery(settingsQuery(params.lang));
    void context.queryClient.prefetchQuery(tripQuery(params.lang));
  },
  component: LangLayout,
  notFoundComponent: NotFoundInLang,
});

function LangLayout() {
  return <Layout lang={useLang()} />;
}

function NotFoundInLang() {
  return <NotFoundPage lang={useLang()} />;
}

const homeRoute = createRoute({
  getParentRoute: () => langRoute,
  path: '/',
  loader: ({ context, params }) => {
    if (isUmrahLang(params.lang)) void context.queryClient.prefetchQuery(homeQuery(params.lang));
  },
  component: lazyRouteComponent(() => import('./pages/HomePage'), 'HomeRoute'),
});

const packageRoute = createRoute({
  getParentRoute: () => langRoute,
  path: 'paket',
  loader: ({ context, params }) => {
    if (isUmrahLang(params.lang)) void context.queryClient.prefetchQuery(packageQuery(params.lang));
  },
  component: lazyRouteComponent(() => import('./pages/PackagePage'), 'PackageRoute'),
});

/** The city filter, and only when it is not «all». */
const ziyaratRoute = createRoute({
  getParentRoute: () => langRoute,
  path: 'ziyarat',
  validateSearch: (search: Record<string, unknown>) =>
    typeof search['city'] === 'string' ? { city: search['city'] } : {},
  loaderDeps: ({ search }) => search,
  loader: ({ context, params, deps }) => {
    if (isUmrahLang(params.lang)) {
      void context.queryClient.prefetchQuery(ziyaratQuery(params.lang, deps.city));
    }
  },
  component: lazyRouteComponent(() => import('./pages/ZiyaratPage'), 'ZiyaratRoute'),
});

const ziyaratDetailRoute = createRoute({
  getParentRoute: () => langRoute,
  path: 'ziyarat/$slug',
  loader: ({ context, params }) => {
    if (isUmrahLang(params.lang)) {
      void context.queryClient.prefetchQuery(ziyaratPlaceQuery(params.lang, params.slug));
    }
  },
  component: lazyRouteComponent(() => import('./pages/ZiyaratDetailPage'), 'ZiyaratDetailRoute'),
});

const programRoute = createRoute({
  getParentRoute: () => langRoute,
  path: 'maksatnama',
  loader: ({ context, params }) => {
    if (isUmrahLang(params.lang)) void context.queryClient.prefetchQuery(programQuery(params.lang));
  },
  component: lazyRouteComponent(() => import('./pages/ProgramPage'), 'ProgramRoute'),
});

/** `?topar=` is which group is being looked at — the one piece of state this page has. */
const creditsRoute = createRoute({
  getParentRoute: () => langRoute,
  path: 'credits',
  component: lazyRouteComponent(() => import('./pages/CreditsPage'), 'CreditsRoute'),
});

const mediaRoute = createRoute({
  getParentRoute: () => langRoute,
  path: 'suratlar',
  validateSearch: (search: Record<string, unknown>) =>
    typeof search['topar'] === 'string' ? { topar: search['topar'] } : {},
  loader: ({ context, params }) => {
    if (isUmrahLang(params.lang)) {
      void context.queryClient.prefetchQuery(groupsQuery(params.lang, 6));
    }
  },
  component: lazyRouteComponent(() => import('./pages/MediaPage'), 'MediaRoute'),
});

const signupRoute = createRoute({
  getParentRoute: () => langRoute,
  path: 'yazylmak',
  component: lazyRouteComponent(() => import('./pages/SignupPage'), 'SignupRoute'),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  langRoute.addChildren([
    homeRoute,
    packageRoute,
    ziyaratRoute,
    ziyaratDetailRoute,
    programRoute,
    mediaRoute,
    signupRoute,
    creditsRoute,
  ]),
]);

export function buildRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    scrollRestoration: true,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof buildRouter>;
  }
}
