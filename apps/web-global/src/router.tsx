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
  articleQuery,
  articlesQuery,
  builderConfigQuery,
  countryQuery,
  faqQuery,
  galleryQuery,
  homeQuery,
  hotelQuery,
  hotelsQuery,
  reviewsQuery,
  settingsQuery,
  tourQuery,
  toursQuery,
  videosQuery,
} from './api/queries';
import { Layout } from './layout/Layout';
import { bestLang, isGlobalLang } from './lib/lang';
import { useLang } from './lib/routeParams';
import { NotFoundPage } from './pages/NotFoundPage';

/*
 * Every page is its own download, and this file names only the names.
 *
 * It used to import all fifteen pages directly, so one bundle held the whole site: a visitor
 * who opened a tour was sent the builder, the gallery's mosaic packer, the video player and the
 * form library, and then the tour. That is 170 KB of script before anything appears, on a mobile
 * connection in Ashgabat — the audience this project's 200 KB budget was written for.
 *
 * `lazyRouteComponent` splits at the import and, because the router runs `defaultPreload:
 * 'intent'`, fetches the chunk while the pointer is still on the link. The click itself is
 * almost never the moment the download starts, and for the visitor who arrives by keyboard or
 * by paste it is one extra request against a page that is otherwise a third smaller.
 *
 * The loaders stay here and stay eager: they are query keys, they are small, and they are what
 * lets the data and the code be fetched at the same time rather than one after the other. The
 * page's chunk and the page's data are therefore requested together, which is the difference
 * between splitting a route and merely delaying it.
 *
 * The homepage is split too, and the round trip it adds is the reason to say why. Its chunk is
 * three kilobytes and the request for it starts in the same tick as the request for `GET
 * /global/home` — which is the thing the first paint is actually waiting on, over a mobile
 * connection, by an order of magnitude. Keeping it eager would have brought its lead form and
 * its builder back into the entry to save a wait nobody would measure.
 */

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
 *
 * The rest of the path comes with them. It used to be dropped — every wrong language landed on
 * the homepage — which was tolerable while the only way to get here was mistyping. It stopped
 * being tolerable when Turkish was retired (Q-17): `/tr/tours` and `/tr/hotels/…` are addresses
 * that worked, that people were sent, and that search engines have. Sending all of them to the
 * homepage throws away the one thing the visitor actually asked for, and it is the difference
 * between a language being taken down and a hundred links being broken.
 */
const langRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$lang',
  beforeLoad: ({ params, location }) => {
    if (!isGlobalLang(params.lang)) {
      const lang = bestLang(navigator.languages);
      // `/tr/tours?filter=desert` -> `/ru/tours?filter=desert`. Everything after the language
      // segment is carried across verbatim, including the query and the hash: a filtered list
      // or a scrolled-to section is what was shared, not the page it lives on.
      const rest = location.href.slice(`/${params.lang}`.length);

      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ href: `/${lang}${rest}`, replace: true });
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

function LangLayout() {
  return <Layout lang={useLang()} />;
}

function NotFoundInLang() {
  return <NotFoundPage lang={useLang()} />;
}

/**
 * The homepage.
 *
 * `validateSearch` passes everything through, because the builder embedded in section three
 * writes its selection into *this* page's query string — the same component, the same store,
 * one `basePath` apart. Naming the eight step parameters here would put the catalogue's
 * vocabulary in a second place.
 */
const homeRoute = createRoute({
  getParentRoute: () => langRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>) => search,
  loader: ({ context, params }) => {
    if (!isGlobalLang(params.lang)) return;
    void context.queryClient.prefetchQuery(homeQuery(params.lang));
    // The builder is below the fold but its configuration is small and its absence is what
    // would make section three pop in as skeletons after everything else has settled.
    void context.queryClient.prefetchQuery(builderConfigQuery(params.lang));
  },
  component: lazyRouteComponent(() => import('./pages/HomePage'), 'HomeRoute'),
});

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
  component: lazyRouteComponent(() => import('./pages/ToursPage'), 'ToursRoute'),
});

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
  component: lazyRouteComponent(() => import('./pages/BuilderPage'), 'BuilderRoute'),
});

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
  component: lazyRouteComponent(() => import('./pages/HotelsPage'), 'HotelsRoute'),
});

const contactRoute = createRoute({
  getParentRoute: () => langRoute,
  path: 'contact',
  /** Only the tab, and only when it is not the default one. */
  validateSearch: (search: Record<string, unknown>) =>
    search['kind'] === 'question' ? { kind: 'question' as const } : {},
  loader: ({ context, params }) => {
    if (isGlobalLang(params.lang)) {
      void context.queryClient.prefetchQuery(faqQuery(params.lang));
    }
  },
  component: lazyRouteComponent(() => import('./pages/ContactPage'), 'ContactRoute'),
});

const creditsRoute = createRoute({
  getParentRoute: () => langRoute,
  path: 'credits',
  component: lazyRouteComponent(() => import('./pages/CreditsPage'), 'CreditsRoute'),
});

const countryRoute = createRoute({
  getParentRoute: () => langRoute,
  path: 'turkmenistan',
  loader: ({ context, params }) => {
    if (isGlobalLang(params.lang))
      void context.queryClient.prefetchQuery(countryQuery(params.lang));
  },
  component: lazyRouteComponent(() => import('./pages/CountryPage'), 'CountryRoute'),
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
  component: lazyRouteComponent(() => import('./pages/ReviewsPage'), 'ReviewsRoute'),
});

const articlesRoute = createRoute({
  getParentRoute: () => langRoute,
  path: 'articles',
  validateSearch: listSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, params, deps }) => {
    if (!isGlobalLang(params.lang)) return;
    void context.queryClient.prefetchQuery(
      articlesQuery(params.lang, { perPage: (deps.page ?? 1) * 9 }),
    );
  },
  component: lazyRouteComponent(() => import('./pages/ArticlesPage'), 'ArticlesRoute'),
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
  component: lazyRouteComponent(() => import('./pages/GalleryPage'), 'GalleryRoute'),
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
  component: lazyRouteComponent(() => import('./pages/VideoPage'), 'VideoRoute'),
});

/*
 * Named components rather than inline arrows.
 *
 * `useLang` is a hook, and a hook inside `component: () => …` sits in a function React's lint
 * rules cannot recognise as a component — which is not pedantry: the same anonymity is what
 * would let a hook end up behind a condition without anything noticing.
 */

// Named rather than an inline arrow, like every other route here: `useLang` is a hook, and a
// hook inside `component: () => …` sits in a function React's rules do not see as a component.

/*
 * The three detail routes.
 *
 * They are the only addresses on this site that can be wrong — a renamed slug, an unpublished
 * tour, a link somebody saved a year ago — so their pages answer a 404 with the not-found page
 * rather than with «проверьте соединение». `defaultPreload: 'intent'` means the loader below
 * usually runs while the pointer is still on the card, so the page is already there when it is
 * clicked; on a slow connection the same prefetch is simply a head start.
 */
const tourDetailRoute = createRoute({
  getParentRoute: () => langRoute,
  path: 'tours/$slug',
  loader: ({ context, params }) => {
    if (isGlobalLang(params.lang)) {
      void context.queryClient.prefetchQuery(tourQuery(params.lang, params.slug));
    }
  },
  component: lazyRouteComponent(() => import('./pages/TourDetailPage'), 'TourDetailRoute'),
});

const hotelDetailRoute = createRoute({
  getParentRoute: () => langRoute,
  path: 'hotels/$slug',
  loader: ({ context, params }) => {
    if (isGlobalLang(params.lang)) {
      void context.queryClient.prefetchQuery(hotelQuery(params.lang, params.slug));
    }
  },
  component: lazyRouteComponent(() => import('./pages/HotelDetailPage'), 'HotelDetailRoute'),
});

const articleDetailRoute = createRoute({
  getParentRoute: () => langRoute,
  path: 'articles/$slug',
  loader: ({ context, params }) => {
    if (isGlobalLang(params.lang)) {
      void context.queryClient.prefetchQuery(articleQuery(params.lang, params.slug));
    }
  },
  component: lazyRouteComponent(() => import('./pages/ArticleDetailPage'), 'ArticleDetailRoute'),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  langRoute.addChildren([
    homeRoute,
    toursRoute,
    tourDetailRoute,
    builderRoute,
    hotelsRoute,
    hotelDetailRoute,
    articleDetailRoute,
    contactRoute,
    countryRoute,
    reviewsRoute,
    articlesRoute,
    galleryRoute,
    videoRoute,
    creditsRoute,
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
