import { ApiRequestError } from '@charva/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@charva/ui/theme.css';
import '@charva/ui/styles.css';

import { SessionProvider } from './auth/SessionProvider';
import { buildRouter } from './router';

/**
 * The admin's client, which differs from the public sites' in one way that matters.
 *
 * A 401 is not retried here either — but it is also not a failure the user should ever see:
 * `adminApi` exchanges the refresh cookie for a new access token and repeats the request once.
 * By the time an error reaches this layer, the session is genuinely over.
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
      // Unlike a visitor's tab, this one is left open all day beside a phone. Coming back to a
      // list that still shows what was there at nine in the morning is the wrong default here.
      refetchOnWindowFocus: true,
    },
  },
});

const router = buildRouter(queryClient);

const container = document.getElementById('root');
if (!container) throw new Error('#root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>,
);
