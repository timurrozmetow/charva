import { useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback } from 'react';

export interface ListSearch {
  filter: string;
  page: number;
  setFilter: (value: string) => void;
  nextPage: () => void;
}

/**
 * The filter and the page, in the URL.
 *
 * A filtered catalogue that cannot be linked to is one nobody can send to the person they are
 * travelling with, and a page that resets its filter on a back button is a page that loses the
 * visitor's work. Both are free once the URL is the store.
 *
 * A default never reaches the address bar: `/ru/hotels` and `/ru/hotels?filter=all&page=1` are
 * the same page, and one page should have one address — otherwise every share, every analytics
 * row and every cache entry splits in two for nothing.
 */
export function useListSearch(basePath: string, allValue = 'all'): ListSearch {
  const navigate = useNavigate();
  const search: Record<string, unknown> = useSearch({ strict: false });

  const raw = search['filter'];
  const filter = typeof raw === 'string' && raw !== '' ? raw : allValue;

  const rawPage = search['page'];
  const page = Math.max(
    1,
    Number(typeof rawPage === 'string' || typeof rawPage === 'number' ? rawPage : 1) || 1,
  );

  const write = useCallback(
    (next: Record<string, unknown>) => {
      void navigate({
        to: basePath,
        search: (prev: Record<string, unknown>) => {
          const merged: Record<string, unknown> = { ...prev, ...next };
          const defaults: Record<string, unknown> = { filter: allValue, page: 1 };
          return Object.fromEntries(
            Object.entries(merged).filter(([key, value]) => value !== defaults[key]),
          );
        },
        replace: true,
      });
    },
    [navigate, basePath, allValue],
  );

  return {
    filter,
    page,
    // Changing a filter returns to the first page: staying on page three of a list that now has
    // one page shows an empty grid and looks like a bug.
    setFilter: useCallback(
      (value: string) => {
        write({ filter: value, page: 1 });
      },
      [write],
    ),
    nextPage: useCallback(() => {
      write({ page: page + 1 });
    }, [write, page]),
  };
}
