import { type Lang } from '@charva/contracts';
import { type QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  useParams,
} from '@tanstack/react-router';

import { settingsQuery, toursQuery } from './api/queries';
import { Layout } from './layout/Layout';
import { bestLang, isGlobalLang } from './lib/lang';
import { NotFoundPage } from './pages/NotFoundPage';
import { ToursPage } from './pages/ToursPage';

/**
 * Every URL carries its language, and the browser's preference decides only where `/` goes.
 *
 * A page that picked its language from a header on every request would serve two visitors
 * different content at one address, and the main channel for sharing these links is Telegram —
 * where the address is the whole message.
 */

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Outlet,
  notFoundComponent: () => <NotFoundPage lang="ru" />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    /*
     * `redirect()` returns a router signal rather than an Error, and throwing it is how a
     * loader navigates. Wrapping it would stop the router recognising it.
     */
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({
      to: '/$lang',
      params: { lang: bestLang(navigator.languages) },
      replace: true,
    });
  },
});

/**
 * The language segment, and the shell every page renders inside.
 *
 * An unknown language redirects rather than 404s: `/de/tours` is a person who guessed or a link
 * that outlived a change, and the Russian catalogue is more use to them than a dead end. The API
 * answers 400 to the same mistake, because there the caller is a program and a silent fallback
 * would hide a broken request.
 */
const langRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$lang',
  beforeLoad: ({ params }) => {
    if (!isGlobalLang(params.lang)) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({
        to: '/$lang',
        params: { lang: bestLang(navigator.languages) },
        replace: true,
      });
    }
  },
  loader: ({ context, params }) => {
    // The footer needs contacts on every page; started here so it is not a second wait after
    // whatever the page itself is fetching.
    if (isGlobalLang(params.lang))
      void context.queryClient.prefetchQuery(settingsQuery(params.lang));
  },
  component: LangLayout,
  notFoundComponent: NotFoundInLang,
});

function useLang(): Lang {
  const { lang }: { lang?: string } = useParams({ strict: false });
  return lang !== undefined && isGlobalLang(lang) ? lang : 'ru';
}

function LangLayout() {
  return <Layout lang={useLang()} />;
}

function NotFoundInLang() {
  return <NotFoundPage lang={useLang()} />;
}

const toursRoute = createRoute({
  getParentRoute: () => langRoute,
  path: 'tours',
  validateSearch: (search: Record<string, unknown>) => ({
    ...(typeof search['category'] === 'string' ? { category: search['category'] } : {}),
    ...(typeof search['sort'] === 'string' ? { sort: search['sort'] } : {}),
    ...(typeof search['page'] === 'number' || typeof search['page'] === 'string'
      ? { page: Math.max(1, Number(search['page']) || 1) }
      : {}),
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ context, params, deps }) => {
    if (!isGlobalLang(params.lang)) return;
    void context.queryClient.prefetchQuery(
      toursQuery(params.lang, {
        ...(deps.category === undefined ? {} : { category: deps.category }),
        sort: deps.sort ?? 'popular',
        perPage: (deps.page ?? 1) * 9,
      }),
    );
  },
  component: ToursRoute,
});

function ToursRoute() {
  return <ToursPage lang={useLang()} />;
}

const routeTree = rootRoute.addChildren([indexRoute, langRoute.addChildren([toursRoute])]);

export function buildRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    // Every navigation lands at the top: these are separate documents, not a scrolling feed.
    scrollRestoration: true,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof buildRouter>;
  }
}
