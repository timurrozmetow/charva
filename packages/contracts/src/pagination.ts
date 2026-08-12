import { z } from 'zod';

/**
 * Page-and-size pagination.
 *
 * Offsets rather than cursors, because the catalogue is a few hundred rows that an editor
 * reorders by hand: a cursor over a list whose `sort_order` changes under it skips and
 * repeats rows, and the admin's «page 4» has to mean page 4.
 *
 * `perPage` is capped. Without a ceiling, `?perPage=100000` is a one-line denial of service
 * against a public endpoint.
 */

export const MAX_PER_PAGE = 100;

/** What the gallery and the group mosaics load at a time — sixteen tiles, four rows of four. */
export const DEFAULT_PER_PAGE = 16;

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(MAX_PER_PAGE).default(DEFAULT_PER_PAGE),
});

export type PaginationQuery = z.infer<typeof paginationQuery>;

export interface PageMeta {
  page: number;
  perPage: number;
  /** Total matching rows, so «Показано 16 из 248» is a fact rather than a literal — D-6. */
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

export function pageMeta(query: PaginationQuery, total: number): PageMeta {
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.perPage);
  return {
    page: query.page,
    perPage: query.perPage,
    total,
    totalPages,
    hasMore: query.page < totalPages,
  };
}

/** `LIMIT ? OFFSET ?`, so the arithmetic exists once. */
export function pageSlice(query: PaginationQuery): { limit: number; offset: number } {
  return { limit: query.perPage, offset: (query.page - 1) * query.perPage };
}
