import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, type RenderResult, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { expect, vi } from 'vitest';

/**
 * Just enough of the router for a test to read the URL it produced.
 *
 * The full generic type is enormous and differs per route tree; naming only what is asserted
 * keeps this helper from having to know the shape of every page's search parameters.
 */
export interface TestRouter {
  state: { location: { pathname: string; searchStr: string } };
}

/**
 * Renders a page inside a real router.
 *
 * Every page here contains `<Link>`s, and deliberately: navigation, breadcrumbs, cards and the
 * language switcher all have to produce genuine anchors with genuine hrefs, or the site cannot
 * be shared, bookmarked or crawled. A stubbed router would happily produce anything, so the
 * tests would prove nothing about the one property that matters.
 *
 * A memory history keeps it in-process and gives each test its own isolated router.
 */
export async function renderPage(
  ui: ReactNode,
  { path = '/ru' }: { path?: string } = {},
): Promise<RenderResult & { queryClient: QueryClient; router: TestRouter }> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  const rootRoute = createRootRoute();
  const langRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/$lang',
    component: () => ui,
    validateSearch: (search: Record<string, unknown>) => search,
  });
  const childRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/$lang/$',
    component: () => ui,
    validateSearch: (search: Record<string, unknown>) => search,
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([langRoute, childRoute]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });

  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
  );

  // `RouterProvider` resolves its first match asynchronously; without this the first assertion
  // runs against an empty container.
  await waitFor(() => {
    expect(result.container.firstChild).not.toBeNull();
  });

  // The router is handed back so a test can read the URL it produced. A memory history never
  // touches `window.location`, and asserting against that would quietly assert nothing.
  return Object.assign(result, { queryClient, router });
}

export interface StubbedCall {
  url: string;
  method: string;
  /** The parsed JSON body of a POST, so a test can assert what was actually sent. */
  body: unknown;
}

/**
 * Answers every request with one payload, chosen by what the URL contains.
 *
 * Keyed by a path fragment rather than by an exact URL: the queries add `?lang=` and a page
 * size, and a test that had to reproduce those exactly would break every time a default moved
 * without anything actually being wrong.
 *
 * Returns the list it records into. For the lead form that is the whole point of the test —
 * what matters is not that the button did something but that `consent`, `kind` and the signed
 * token left the browser.
 */
export function stubApi(routes: Record<string, unknown>): StubbedCall[] {
  const calls: StubbedCall[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({
        url,
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      });

      const match = Object.entries(routes).find(([fragment]) => url.includes(fragment));

      if (match === undefined) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: { code: 'not_found', message: `No stub for ${url}`, requestId: 'test' },
            }),
            { status: 404, headers: { 'content-type': 'application/json' } },
          ),
        );
      }

      const payload = match[1];
      if (payload instanceof StubFailure) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: { code: payload.code, message: payload.code, requestId: 'test' },
            }),
            { status: payload.status, headers: { 'content-type': 'application/json' } },
          ),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }),
  );

  return calls;
}

/** A route that answers with the API's error envelope — the rate limit, mostly. */
export class StubFailure {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {}
}
