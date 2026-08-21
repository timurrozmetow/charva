import { ApiRequestError } from '@charva/contracts';
import { hideBootSplash } from '@charva/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@charva/ui/theme.css';
import '@charva/ui/styles.css';

import { buildRouter } from './router';

/**
 * One retry, never for a refusal, and no refetch when the tab regains focus.
 *
 * A 4xx is not retried: the server understood the request and refused it. The seat count is the
 * one thing here that genuinely changes during a visit, and it is covered by the API's own
 * sixty-second window rather than by asking again every time somebody switches tabs.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiRequestError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
  },
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

hideBootSplash();
