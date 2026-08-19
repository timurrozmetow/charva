import { formatMoney, type Lang } from '@charva/contracts';
import {
  Button,
  Container,
  EmptyState,
  Eyebrow,
  FilterChipRow,
  Heading,
  LoadMore,
  Section,
  StatStrip,
} from '@charva/ui';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useMemo } from 'react';

import { toursQuery } from '../api/queries';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { QueryState } from '../components/QueryState';
import { TourCard } from '../components/TourCard';
import { copyFor, fill } from '../i18n';
import { path } from '../lib/routes';
import { useDocumentMeta } from '../lib/useDocumentMeta';

export interface ToursPageProps {
  lang: Lang;
}

/** The «Все» chip is a UI affordance, not a category — it means «no filter». */
const ALL = 'all';

/**
 * The catalogue.
 *
 * Three things here are corrections rather than transcriptions.
 *
 * The chips are built from the facets the API counted, not from a hardcoded list (D-15), so a
 * chip only exists when rows exist behind it and can never lead to an empty grid. The prototype
 * hardcodes six and filters nine rows in memory.
 *
 * The counter says «Показано 9 из 9». The prototype renders «Показано {{shownCount}} из 32»
 * with the denominator typed in beside nine rows of data (D-6) — and the three figures in the
 * header are the same kind of literal, so they are computed too.
 *
 * The filter lives in the URL. A filtered catalogue that cannot be linked to is a filtered
 * catalogue nobody can send to the person they are travelling with.
 */
export function ToursPage({ lang }: ToursPageProps) {
  const copy = copyFor(lang);
  const navigate = useNavigate();
  const search: { category?: string; sort?: string; page?: number } = useSearch({ strict: false });

  const category = search.category ?? ALL;
  const sort = search.sort ?? 'popular';
  const page = search.page ?? 1;

  const query = useQuery(
    toursQuery(lang, {
      ...(category === ALL ? {} : { category }),
      sort,
      // «Показать ещё» grows the page size rather than paging, so tiles already on screen keep
      // their place — the same reason the mosaic packer is prefix-stable (D-16, D-37).
      perPage: page * 9,
    }),
  );

  useDocumentMeta({ route: 'tours', pathAfterLang: '/tours' }, lang);

  const setSearch = (next: Partial<{ category: string; sort: string; page: number }>) => {
    void navigate({
      to: path.tours(lang),
      search: (prev: Record<string, unknown>) => {
        const merged: Record<string, unknown> = { ...prev, ...next };

        /*
         * A default never reaches the URL.
         *
         * `/ru/tours` and `/ru/tours?category=all&sort=popular&page=1` are the same page, and
         * one page should have one address — otherwise every share, every analytics row and
         * every cache entry splits in two for no reason.
         */
        const defaults: Record<string, unknown> = { category: ALL, sort: 'popular', page: 1 };
        return Object.fromEntries(
          Object.entries(merged).filter(([key, value]) => value !== defaults[key]),
        );
      },
      replace: true,
    });
  };

  const options = useMemo(() => {
    const facets = query.data?.facets.categories ?? [];
    const labels: Record<string, string> = copy.categories;
    return [
      { value: ALL, label: copy.tours.all, count: query.data?.meta.total ?? 0 },
      ...facets.map((facet) => ({
        value: facet.code,
        // The API answers with the code; the label is interface copy (D-23). An untranslated
        // code is shown as itself rather than as blank — visible, and reportable.
        label: labels[facet.code] ?? facet.code,
        count: facet.count,
      })),
    ];
  }, [query.data, copy]);

  // Memoised because the derived figures below depend on it: a fresh `[]` on every render
  // would recompute them on every render and defeat the memo entirely.
  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const total = query.data?.meta.total ?? 0;

  /*
   * The three figures in the header, computed.
   *
   * The prototype prints «32 Маршрута · 3–14 Дней в туре · 540 $ Минимальная цена» as literals
   * above nine rows. The range and the minimum are derived from what is actually published,
   * and the first is the same `COUNT(*)` the counter uses.
   */
  const stats = useMemo(() => {
    if (items.length === 0) return [];
    const days = items.map((tour) => tour.days);
    const cheapest = items.reduce((min, tour) =>
      tour.priceFrom.minor < min.priceFrom.minor ? tour : min,
    );
    const low = Math.min(...days);
    const high = Math.max(...days);
    return [
      { value: String(total), label: copy.tours.stats.routes },
      {
        value: low === high ? String(low) : `${String(low)}–${String(high)}`,
        label: copy.tours.stats.days,
      },
      { value: formatMoney(cheapest.priceFrom), label: copy.tours.stats.minPrice },
    ];
  }, [items, total, copy]);

  return (
    <>
      <Breadcrumbs lang={lang} trail={[{ label: copy.tours.breadcrumb }]} />

      <Section space="sm">
        <Container>
          <div className="grid grid-cols-[1.25fr_1fr] items-end gap-[70px] tab:grid-cols-1 tab:gap-8">
            <div>
              <Eyebrow>{copy.brand}</Eyebrow>
              <Heading level={1} size="h1" className="mt-4">
                {copy.tours.title}
              </Heading>
              <p className="mt-6 max-w-[560px] text-lead font-light text-body">{copy.tours.lead}</p>
            </div>

            {stats.length > 0 && <StatStrip items={stats} />}
          </div>

          <FilterChipRow
            label={copy.tours.filterLabel}
            options={options}
            value={category}
            onValueChange={(value) => {
              setSearch({ category: value, page: 1 });
            }}
            counter={fill(copy.common.shown, { shown: items.length, total })}
            className="mt-13 border-t border-line pt-8"
          />
        </Container>
      </Section>

      <Section space="sm">
        <Container>
          <QueryState
            lang={lang}
            isPending={query.isPending}
            isError={query.isError}
            onRetry={() => void query.refetch()}
            skeletonCount={9}
          >
            {items.length === 0 ? (
              <EmptyState
                title={copy.common.nothingFound}
                description={copy.common.nothingFoundHint}
                action={
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch({ category: ALL, page: 1 });
                    }}
                  >
                    {copy.tours.all}
                  </Button>
                }
              />
            ) : (
              <>
                <ul className="grid list-none grid-cols-3 gap-[26px] p-0 lap:grid-cols-2 mob:grid-cols-1">
                  {items.map((tour, index) => (
                    <li key={tour.id}>
                      <TourCard tour={tour} lang={lang} priority={index < 3} />
                    </li>
                  ))}
                </ul>

                <LoadMore
                  hasMore={query.data?.meta.hasMore ?? false}
                  busy={query.isFetching}
                  onLoadMore={() => {
                    setSearch({ page: page + 1 });
                  }}
                  status={fill(copy.common.shown, { shown: items.length, total })}
                  className="mt-12"
                >
                  {copy.common.showMore}
                </LoadMore>
              </>
            )}
          </QueryState>
        </Container>
      </Section>

      <Section space="sm" className="pb-section">
        <Container>
          {/*
            `data-surface="dark"` rather than a colour class on the heading.

            `text-dark-on` was on the heading and did nothing: `cn` is clsx, so it joined the
            `text-ink` that `Heading` already carries instead of replacing it, and `.text-ink`
            is emitted after `.text-dark-on` — the headline rendered brown on brown and was
            barely visible. The attribute re-points `--c-ink` itself, which is how every other
            dark block on both sites is done, so there is nothing left to lose the race to.
          */}
          <div
            data-surface="dark"
            className="grid grid-cols-[1.2fr_auto] items-center gap-[50px] rounded-block bg-dark p-14 tab:grid-cols-1 tab:gap-8 mob:p-8"
          >
            <div>
              <Heading level={2} size="h2">
                {copy.tours.cta.title}
              </Heading>
              <p className="mt-4 max-w-[520px] text-bodySm font-light text-cream-body">
                {copy.tours.cta.text}
              </p>
            </div>
            <Link
              to={path.builder(lang)}
              className="group inline-flex items-center gap-3.5 rounded-full bg-accent px-8 py-[18px] text-label font-black uppercase text-accent-on no-underline transition-all duration-colour hover:gap-[22px] hover:bg-accent-hover"
            >
              {copy.tours.cta.button}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </Container>
      </Section>
    </>
  );
}
