import { type Facet, type Lang } from '@charva/contracts';
import { Button, Container, EmptyState, FilterChipRow, LoadMore, Section } from '@charva/ui';
import { type ReactNode, useMemo } from 'react';

import { copyFor, fill } from '../i18n';

import { QueryState } from './QueryState';

/** The «Все» chip means «no filter», which is a UI affordance rather than a category. */
export const ALL = 'all';

export interface FilteredGridProps {
  lang: Lang;
  /** Names the chip group for assistive technology — «Фильтр по теме». */
  filterLabel: string;
  allLabel: string;
  facets: readonly Facet[];
  /** Turns a facet code into a word. The API answers with codes; the words are copy (D-23). */
  labelFor: (code: string) => string;
  value: string;
  onValueChange: (value: string) => void;
  shown: number;
  total: number;
  hasMore: boolean;
  onLoadMore: () => void;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  onRetry: () => void;
  skeletonCount?: number;
  children: ReactNode;
}

/**
 * A filter row, a grid, a counter and a «показать ещё» — the shape four pages share.
 *
 * Written once because the four differ only in what they list. In the prototypes they are four
 * copies of the same machine that have already drifted: the tours page keys its chips by plain
 * strings, the reviews page by `{key,label}` objects, and the reviews page's fourth chip
 * («Сначала новые») has no handler at all, so it silently does nothing.
 *
 * Every counter here is counted. «Показано N из 32», «из 46», «из 214», «из 248» are literals in
 * four different files, each contradicting the nine or fourteen rows beneath it (D-6).
 */
export function FilteredGrid({
  lang,
  filterLabel,
  allLabel,
  facets,
  labelFor,
  value,
  onValueChange,
  shown,
  total,
  hasMore,
  onLoadMore,
  isPending,
  isFetching,
  isError,
  onRetry,
  skeletonCount = 9,
  children,
}: FilteredGridProps) {
  const copy = copyFor(lang);

  const options = useMemo(
    () => [
      { value: ALL, label: allLabel, count: total },
      ...facets.map((facet) => ({
        value: facet.code,
        label: labelFor(facet.code),
        count: facet.count,
      })),
    ],
    [facets, labelFor, allLabel, total],
  );

  const counter = fill(copy.common.shown, { shown, total });

  return (
    <>
      <Section space="none">
        <Container>
          <FilterChipRow
            label={filterLabel}
            options={options}
            value={value}
            onValueChange={onValueChange}
            counter={counter}
            className="mt-13 border-t border-line pt-8"
          />
        </Container>
      </Section>

      <Section space="sm">
        <Container>
          <QueryState
            lang={lang}
            isPending={isPending}
            isError={isError}
            onRetry={onRetry}
            skeletonCount={skeletonCount}
          >
            {shown === 0 ? (
              <EmptyState
                title={copy.common.nothingFound}
                description={copy.common.nothingFoundHint}
                action={
                  <Button
                    variant="outline"
                    onClick={() => {
                      onValueChange(ALL);
                    }}
                  >
                    {allLabel}
                  </Button>
                }
              />
            ) : (
              <>
                {children}
                <LoadMore
                  hasMore={hasMore}
                  busy={isFetching}
                  onLoadMore={onLoadMore}
                  status={counter}
                  className="mt-12"
                >
                  {copy.common.showMore}
                </LoadMore>
              </>
            )}
          </QueryState>
        </Container>
      </Section>
    </>
  );
}
