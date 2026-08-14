import { ApiRequestError } from '@charva/contracts';
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
 * The catalogue changes a few times a month. Refetching everything because somebody switched
 * back to the tab spends a visitor's mobile data to learn nothing, and the API's own sixty
 * second cache would answer identically anyway.
 *
 * A 4xx is not retried at all: the server understood the request and refused it, so asking
 * again gets the same answer — and the common case is a dead link to a tour that was
 * unpublished, where the retry is a second round trip before the visitor can be told.
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
