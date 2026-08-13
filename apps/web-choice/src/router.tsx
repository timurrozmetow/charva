import { type Lang } from '@charva/contracts';
import { type QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';

import { choiceQuery } from './api/choice';
import { ChoicePage } from './ChoicePage';
import { bestLang, isChoiceLang } from './lib/best-lang';

/**
 * Two routes: the bare root, which only redirects, and the page itself under its language.
 *
 * Every URL that renders anything carries its language, so a link shared into a Telegram group
 * opens in the language the sharer was reading. The header is consulted exactly once, on `/`,
 * and never again — a page that picked its language from a header on every request would serve
 * two visitors different content at one address and make the URL useless as a reference.
 */

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Outlet,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    /*
     * `navigator.languages` is in preference order; `bestLang` maps the browser's `tk` for
     * Turkmen onto this project's `tm` and falls back to Russian.
     *
     * The throw is deliberate and the rule below is disabled for it: `redirect()` returns a
     * signal object rather than an Error, and throwing it is how TanStack Router is told to
     * navigate out of a loader. Wrapping it would stop the router recognising it.
     */
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
  /**
   * An unknown language is a redirect, not a 404.
   *
   * `/de` is a person who guessed, or an old link, and sending them to the Russian page is more
   * useful than a dead end. The API is stricter about the same parameter and answers 400,
   * because there the caller is a program and a silent fallback would hide the broken request.
   */
  beforeLoad: ({ params }) => {
    if (!isChoiceLang(params.lang)) {
      // See the note above: `redirect()` is a router signal, not an Error.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({
        to: '/$lang',
        params: { lang: bestLang(navigator.languages) },
        replace: true,
      });
    }
  },
  /** Started before the component renders, so the badge is filled by the time it paints. */
  loader: ({ context, params }) => {
    // Already narrowed by `beforeLoad`, but checked again rather than asserted: a cast here
    // would be a promise about another function's behaviour instead of a fact about this one.
    if (isChoiceLang(params.lang)) {
      void context.queryClient.prefetchQuery(choiceQuery(params.lang));
    }
  },
  component: LangPage,
});

function LangPage() {
  const { lang } = langRoute.useParams();
  return <ChoicePage lang={lang as Lang} />;
}

const routeTree = rootRoute.addChildren([indexRoute, langRoute]);

export function buildRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    // One screen: there is nothing to scroll back to and nothing below the fold on a desktop.
    scrollRestoration: false,
    defaultPreload: 'intent',
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof buildRouter>;
  }
}
