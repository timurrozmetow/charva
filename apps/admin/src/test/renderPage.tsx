import { type AdminSessionResponse, type AdminUser } from '@charva/contracts';
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

import { setAccessToken } from '../api/client';
import { SessionProvider } from '../auth/SessionProvider';

/**
 * A page, inside a real router and a real session.
 *
 * The session is real rather than mocked because the thing most worth testing about this admin
 * is what it refuses to show — and a mocked `useSession` would happily claim any capability
 * asked of it. Here the provider does what it does in the browser: exchanges the refresh cookie
 * for a token and takes the user, capabilities included, from the answer.
 */

export interface TestRouter {
  state: { location: { pathname: string; searchStr: string } };
}

export interface RenderOptions {
  path?: string;
  /** Route pattern the page is mounted at, when it reads parameters out of the URL. */
  route?: string;
}

export async function renderPage(
  ui: ReactNode,
  { path = '/', route = '/' }: RenderOptions = {},
): Promise<RenderResult & { queryClient: QueryClient; router: TestRouter }> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  const rootRoute = createRootRoute();
  const pageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: route,
    component: () => ui,
    validateSearch: (search: Record<string, unknown>) => search,
  });
  const catchAll = createRoute({
    getParentRoute: () => rootRoute,
    path: '/$',
    component: () => ui,
    validateSearch: (search: Record<string, unknown>) => search,
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren(route === '/' ? [pageRoute, catchAll] : [pageRoute, catchAll]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });

  const result = render(
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <RouterProvider router={router as never} />
      </SessionProvider>
    </QueryClientProvider>,
  );

  await waitFor(() => {
    expect(result.container.firstChild).not.toBeNull();
  });

  return Object.assign(result, { queryClient, router });
}

export interface StubbedCall {
  url: string;
  method: string;
  body: unknown;
  /** So a test can assert that a request went out carrying the session. */
  authorization: string | undefined;
}

/** The account every test signs in as, unless it says otherwise. */
export const OWNER: AdminUser = {
  id: 1,
  email: 'owner@charva.test',
  name: 'Владелец',
  role: 'owner',
  siteScope: null,
  capabilities: [
    'content.read',
    'content.write',
    'media.write',
    'leads.read',
    'leads.write',
    'passport.reveal',
    'users.manage',
    'settings.write',
    'audit.read',
  ],
  lastLoginAt: null,
};

export function sessionFor(user: Partial<AdminUser> = {}): AdminSessionResponse {
  return { accessToken: 'test.token.value', expiresInSeconds: 900, user: { ...OWNER, ...user } };
}

/**
 * Answers every request with one payload, chosen by what the URL contains.
 *
 * Keyed by a fragment rather than an exact URL, for the same reason the public sites' helper is:
 * the queries add page sizes and filters, and a test reproducing those exactly would break every
 * time a default moved without anything being wrong.
 */
export function stubApi(routes: Record<string, unknown>): StubbedCall[] {
  const calls: StubbedCall[] = [];
  setAccessToken(null);

  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = (init?.headers ?? {}) as Record<string, string>;

      calls.push({
        url,
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
        authorization: headers['authorization'],
      });

      /*
       * A stub that matches the end of the path wins over one that merely appears in it.
       *
       * `/admin/umrah_signups/5/passport` contains `/admin/umrah_signups`, so a plain
       * first-match rule answers the reveal with the list — which looks, from the test, exactly
       * like the reveal button doing nothing.
       */
      const path = url.split('?')[0] ?? url;
      const candidates = Object.entries(routes).filter(([fragment]) => url.includes(fragment));
      const match = candidates.find(([fragment]) => path.endsWith(fragment)) ?? candidates[0];

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

export class StubFailure {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {}
}
