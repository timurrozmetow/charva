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

import {
  builderConfigQuery,
  countryQuery,
  galleryQuery,
  hotelsQuery,
  reviewsQuery,
  settingsQuery,
  toursQuery,
  videosQuery,
} from './api/queries';
import { Layout } from './layout/Layout';
import { bestLang, isGlobalLang } from './lib/lang';
import { BuilderPage } from './pages/BuilderPage';
import { CountryPage } from './pages/CountryPage';
import { GalleryPage } from './pages/GalleryPage';
import { HotelsPage } from './pages/HotelsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ReviewsPage } from './pages/ReviewsPage';
import { ToursPage } from './pages/ToursPage';
import { VideoPage } from './pages/VideoPage';

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

/**
 * The builder's whole state is in the query string, so the route accepts anything and the
 * component decides what it means. Validating each option code here would put the catalogue's
 * vocabulary in two places.
 */
const builderRoute = createRoute({
  getParentRoute: () => langRoute,
  path: 'builder',
  validateSearch: (search: Record<string, unknown>) => search,
  loader: ({ context, params }) => {
    if (isGlobalLang(params.lang)) {
      void context.queryClient.prefetchQuery(builderConfigQuery(params.lang));
    }
  },
  component: BuilderRoute,
});

function BuilderRoute() {
  return <BuilderPage lang={useLang()} />;
}

/**
 * The three list pages share one search shape — `filter` and `page` — so they share one
 * validator. Writing it once means a fourth list added in phase 7 cannot invent a third
 * spelling of the same two parameters.
 */
const listSearch = (search: Record<string, unknown>) => ({
  ...(typeof search['filter'] === 'string' ? { filter: search['filter'] } : {}),
  ...(typeof search['page'] === 'number' || typeof search['page'] === 'string'
    ? { page: Math.max(1, Number(search['page']) || 1) }
    : {}),
});

const hotelsRoute = createRoute({
  getParentRoute: () => langRoute,
  path: 'hotels',
  validateSearch: listSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, params, deps }) => {
    if (!isGlobalLang(params.lang)) return;
    void context.queryClient.prefetchQuery(
      hotelsQuery(params.lang, {
        ...(deps.filter === undefined || deps.filter === 'all' ? {} : { filter: deps.filter }),
        perPage: (deps.page ?? 1) * 9,
      }),
    );
  },
  component: HotelsRoute,
});

const countryRoute = createRoute({
  getParentRoute: () => langRoute,
  path: 'turkmenistan',
  loader: ({ context, params }) => {
    if (isGlobalLang(params.lang))
      void context.queryClient.prefetchQuery(countryQuery(params.lang));
  },
  component: CountryRoute,
});

const reviewsRoute = createRoute({
  getParentRoute: () => langRoute,
  path: 'reviews',
  validateSearch: listSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, params, deps }) => {
    if (!isGlobalLang(params.lang)) return;
    const rating = deps.filter === '5' || deps.filter === '4' ? Number(deps.filter) : undefined;
    void context.queryClient.prefetchQuery(
      reviewsQuery(params.lang, {
        ...(rating === undefined ? {} : { rating }),
        sort: 'newest',
        perPage: (deps.page ?? 1) * 9,
      }),
    );
  },
  component: ReviewsRoute,
});

const galleryRoute = createRoute({
  getParentRoute: () => langRoute,
  path: 'gallery',
  validateSearch: listSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, params, deps }) => {
    if (!isGlobalLang(params.lang)) return;
    void context.queryClient.prefetchQuery(
      galleryQuery(params.lang, {
        ...(deps.filter === undefined || deps.filter === 'all' ? {} : { category: deps.filter }),
        perPage: (deps.page ?? 1) * 16,
      }),
    );
  },
  component: GalleryRoute,
});

const videoRoute = createRoute({
  getParentRoute: () => langRoute,
  path: 'video',
  validateSearch: listSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, params, deps }) => {
    if (!isGlobalLang(params.lang)) return;
    void context.queryClient.prefetchQuery(
      videosQuery(params.lang, {
        ...(deps.filter === undefined || deps.filter === 'all' ? {} : { category: deps.filter }),
        perPage: (deps.page ?? 1) * 9,
      }),
    );
  },
  component: VideoRoute,
});

/*
 * Named components rather than inline arrows.
 *
 * `useLang` is a hook, and a hook inside `component: () => …` sits in a function React's lint
 * rules cannot recognise as a component — which is not pedantry: the same anonymity is what
 * would let a hook end up behind a condition without anything noticing.
 */
function HotelsRoute() {
  return <HotelsPage lang={useLang()} />;
}

function CountryRoute() {
  return <CountryPage lang={useLang()} />;
}

function ReviewsRoute() {
  return <ReviewsPage lang={useLang()} />;
}

function GalleryRoute() {
  return <GalleryPage lang={useLang()} />;
}

function VideoRoute() {
  return <VideoPage lang={useLang()} />;
}

const routeTree = rootRoute.addChildren([
  indexRoute,
  langRoute.addChildren([
    toursRoute,
    builderRoute,
    hotelsRoute,
    countryRoute,
    reviewsRoute,
    galleryRoute,
    videoRoute,
  ]),
]);

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
