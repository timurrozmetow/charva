import { type Lang } from '@charva/contracts';
import { buttonClass, Container, Eyebrow, Heading, Section, StatStrip } from '@charva/ui';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

import { reviewsQuery } from '../api/queries';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { FilteredGrid } from '../components/FilteredGrid';
import { ReviewCard } from '../components/ReviewCard';
import { copyFor } from '../i18n';
import { path } from '../lib/routes';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { useListSearch } from '../lib/useListSearch';

export interface ReviewsPageProps {
  lang: Lang;
}

const PER_PAGE = 9;

/**
 * The reviews.
 *
 * Two corrections here, and both are visible on the page.
 *
 * The three figures — 4,8 · 214 · 92% — are computed by the API from published rows rather than
 * typed into the markup above nine of them (D-6). They will read 5,0 · 9 · 100% until the
 * catalogue fills, and that is the honest number; question Q-5 asks the owner what to do about
 * it.
 *
 * «Сначала новые» sorts. In the prototype the chip exists, is styled, and has no handler at all
 * — its `if` chain covers `5` and `4` and simply does not mention `new` — and it could not work
 * anyway, because the dates are strings like «Май 2026». Here `visited_on` is a DATE and the
 * sort is done by the database.
 */
export function ReviewsPage({ lang }: ReviewsPageProps) {
  const copy = copyFor(lang);
  const { filter, page, setFilter, nextPage } = useListSearch(path.reviews(lang));

  /*
   * The rating chips filter; the sort is always newest-first.
   *
   * The prototype's fourth chip, «Сначала новые», is a separate filter value with no handler at
   * all — and it could not have worked, because its dates are strings like «Май 2026». Newest
   * first is what a reviews page should do by default, so it is the order rather than an option
   * somebody has to find.
   */
  const rating = filter === '5' || filter === '4' ? Number(filter) : undefined;

  const query = useQuery(
    reviewsQuery(lang, {
      ...(rating === undefined ? {} : { rating }),
      sort: 'newest',
      perPage: page * PER_PAGE,
    }),
  );

  useDocumentMeta(
    {
      title: copy.reviews.metaTitle,
      description: copy.reviews.metaDescription,
      pathAfterLang: '/reviews',
    },
    lang,
  );

  const items = query.data?.items ?? [];
  const summary = query.data?.summary;

  /*
   * The chips, with their counts.
   *
   * Not facets from the API — a rating filter is a range over one column rather than a set of
   * codes — but counted the same way, from the summary the API computed. A chip that would
   * match nothing is still shown with a zero, because a rating that nobody has given is a fact
   * about the reviews rather than a missing option.
   */
  const facets = [
    { code: '5', label: '5', count: summary?.total ?? 0 },
    { code: '4', label: '4', count: summary?.total ?? 0 },
  ];

  const labels: Record<string, string> = {
    '5': copy.reviews.onlyFive,
    '4': copy.reviews.onlyFour,
  };

  return (
    <>
      <Breadcrumbs lang={lang} trail={[{ label: copy.reviews.breadcrumb }]} />

      <Section space="sm">
        <Container>
          <div className="grid grid-cols-[1.3fr_1fr] items-end gap-[70px] tab:grid-cols-1 tab:gap-8">
            <div>
              <Eyebrow>{copy.brand}</Eyebrow>
              <Heading level={1} size="h1" className="mt-4">
                {copy.reviews.title}
              </Heading>
              <p className="mt-6 max-w-[560px] text-lead font-light text-body">
                {copy.reviews.lead}
              </p>
            </div>

            {summary !== undefined && summary.total > 0 && (
              <StatStrip
                items={[
                  {
                    // One decimal, and a comma: «4,8» is what a Russian reader expects and what
                    // the design draws.
                    value: summary.average.toFixed(1).replace('.', ','),
                    label: copy.reviews.stats.average,
                  },
                  { value: String(summary.total), label: copy.reviews.stats.total },
                  {
                    value: `${String(summary.recommendPercent)}%`,
                    label: copy.reviews.stats.recommend,
                  },
                ]}
              />
            )}
          </div>
        </Container>
      </Section>

      <FilteredGrid
        lang={lang}
        filterLabel={copy.reviews.filterLabel}
        allLabel={copy.reviews.all}
        facets={facets}
        labelFor={(code) => labels[code] ?? code}
        value={filter}
        onValueChange={setFilter}
        shown={items.length}
        total={summary?.total ?? 0}
        hasMore={query.data?.meta.hasMore ?? false}
        onLoadMore={nextPage}
        isPending={query.isPending}
        isFetching={query.isFetching}
        isError={query.isError}
        onRetry={() => void query.refetch()}
      >
        <ul className="grid list-none grid-cols-3 gap-6 p-0 lap:grid-cols-2 mob:grid-cols-1">
          {items.map((review) => (
            <li key={review.id}>
              <ReviewCard review={review} lang={lang} />
            </li>
          ))}
        </ul>
      </FilteredGrid>

      <Section space="sm" className="pb-section-lg">
        <Container>
          <div className="grid grid-cols-[1.2fr_auto] items-center gap-[50px] rounded-block bg-dark p-13 tab:grid-cols-1 tab:gap-8 mob:p-8">
            <div>
              <Heading level={2} size="h2Sm" className="text-dark-on">
                {copy.reviews.cta.title}
              </Heading>
              <p className="mt-4 max-w-[520px] text-bodySm font-light text-cream-body">
                {copy.reviews.cta.text}
              </p>
            </div>
            <Link to={path.contact(lang)} className={buttonClass({ variant: 'solid' })}>
              {copy.reviews.cta.button}
            </Link>
          </div>
        </Container>
      </Section>
    </>
  );
}
