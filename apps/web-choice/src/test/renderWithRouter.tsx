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
import { expect } from 'vitest';

/**
 * Renders a component that contains router links.
 *
 * The navigation and the language chooser render real `<Link>`s — deliberately, because a
 * language switcher that changes state without changing the URL cannot be shared, bookmarked or
 * crawled. That means they need a router in the tree, and mocking one would test the mock: the
 * whole point of the accessibility work in `LangSwitcher` is that it produces anchors with real
 * hrefs, and a stub would happily produce anything.
 *
 * A memory history keeps it in-process and gives every test a fresh, isolated router.
 */
export async function renderWithRouter(
  ui: ReactNode,
  { path = '/ru' }: { path?: string } = {},
): Promise<RenderResult & { queryClient: QueryClient }> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const rootRoute = createRootRoute();
  const langRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/$lang',
    component: () => ui,
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([langRoute]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });

  const result = render(
    <QueryClientProvider client={queryClient}>
      {/* The generic is intentionally loose: this router exists only for the duration of one
          test and does not share the app's registered route tree. */}
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
  );

  // `RouterProvider` resolves its first match asynchronously; without this the first assertion
  // in a test runs against an empty container.
  await waitFor(() => {
    expect(result.container.firstChild).not.toBeNull();
  });

  return Object.assign(result, { queryClient });
}
