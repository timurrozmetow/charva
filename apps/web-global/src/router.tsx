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
  articleQuery,
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
import { ArticleDetailPage } from './pages/ArticleDetailPage';
import { BuilderPage } from './pages/BuilderPage';
import { ContactPage } from './pages/ContactPage';
import { CountryPage } from './pages/CountryPage';
import { CreditsPage } from './pages/CreditsPage';
import { GalleryPage } from './pages/GalleryPage';
import { HomePage } from './pages/HomePage';
import { HotelDetailPage } from './pages/HotelDetailPage';
import { HotelsPage } from './pages/HotelsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ReviewsPage } from './pages/ReviewsPage';
import { TourDetailPage } from './pages/TourDetailPage';
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

/**
 * The `$slug` of whichever detail route is mounted.
 *
 * Read loosely for the same reason `useLang` is: three routes share one shape, and typing each
 * component against its own route id would be three casts to say one thing. An empty slug is
 * unreachable — the router only mounts these components when the segment exists.
 */
function useSlug(): string {
  const { slug }: { slug?: string } = useParams({ strict: false });
  return slug ?? '';
}

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
  component: HomeRoute,
});

function HomeRoute() {
  return <HomePage lang={useLang()} />;
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
  component: ContactRoute,
});

function ContactRoute() {
  return <ContactPage lang={useLang()} />;
}

const creditsRoute = createRoute({
  getParentRoute: () => langRoute,
  path: 'credits',
  component: CreditsRoute,
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

// Named rather than an inline arrow, like every other route here: `useLang` is a hook, and a
// hook inside `component: () => …` sits in a function React's rules do not see as a component.
function CreditsRoute() {
  return <CreditsPage lang={useLang()} />;
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
  component: TourDetailRoute,
});

function TourDetailRoute() {
  return <TourDetailPage lang={useLang()} slug={useSlug()} />;
}

const hotelDetailRoute = createRoute({
  getParentRoute: () => langRoute,
  path: 'hotels/$slug',
  loader: ({ context, params }) => {
    if (isGlobalLang(params.lang)) {
      void context.queryClient.prefetchQuery(hotelQuery(params.lang, params.slug));
    }
  },
  component: HotelDetailRoute,
});

function HotelDetailRoute() {
  return <HotelDetailPage lang={useLang()} slug={useSlug()} />;
}

const articleDetailRoute = createRoute({
  getParentRoute: () => langRoute,
  path: 'articles/$slug',
  loader: ({ context, params }) => {
    if (isGlobalLang(params.lang)) {
      void context.queryClient.prefetchQuery(articleQuery(params.lang, params.slug));
    }
  },
  component: ArticleDetailRoute,
});

function ArticleDetailRoute() {
  return <ArticleDetailPage lang={useLang()} slug={useSlug()} />;
}

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
