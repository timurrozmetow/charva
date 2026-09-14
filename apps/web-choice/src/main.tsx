import { hideBootSplash, trackPageview } from '@charva/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@charva/ui/theme.css';
import '@charva/ui/styles.css';

import { buildRouter } from './router';

/**
 * `retry: false` on the default, and one retry only where it is worth it.
 *
 * This page renders completely without the network: a request that fails should fail quickly
 * and leave three figures unrendered, not hold a spinner over a screen whose content is
 * already in the bundle.
 */
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

const router = buildRouter(queryClient);

const container = document.getElementById('root');
if (!container) throw new Error('#root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);

/*
 * Every later page view.
 *
 * The counters in the head record the page the bundle loaded on and neither of them notices a
 * client-side route change, so without this a visit to six pages is reported as one. The first
 * resolve is the page already counted, which `trackPageview` drops by address.
 */
router.subscribe('onResolved', () => {
  trackPageview(window.location.href);
});

hideBootSplash();
