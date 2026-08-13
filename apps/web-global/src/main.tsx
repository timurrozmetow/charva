import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@charva/ui/theme.css';
import '@charva/ui/styles.css';

import { buildRouter } from './router';

/**
 * One retry, and no refetch when the tab regains focus.
 *
 * The catalogue changes a few times a month. Refetching everything because somebody switched
 * back to the tab spends a visitor's mobile data to learn nothing, and the API's own sixty
 * second cache would answer identically anyway.
 */
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
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
