import { type Lang } from '@charva/contracts';
import { buttonClass, Container, Eyebrow, Heading, Section } from '@charva/ui';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

import { hotelsQuery } from '../api/queries';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { ALL, FilteredGrid } from '../components/FilteredGrid';
import { HotelCard } from '../components/HotelCard';
import { copyFor } from '../i18n';
import { path } from '../lib/routes';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { useListSearch } from '../lib/useListSearch';

export interface HotelsPageProps {
  lang: Lang;
}

const PER_PAGE = 9;

/**
 * The hotels.
 *
 * The chips are the derived filter keys — `5star`, `boutique`, `camp` — counted by the API from
 * published rows. That derivation is what resolves the contradiction the prototype ships: a
 * yurt camp shown as «3★» on its card and «Кемп» in the filter list, which cannot both be true
 * of one row. Here `category === 'hotel' ? stars + 'star' : category`, computed in one place.
 *
 * No statistics block, unlike tours and reviews — the design does not draw one here, and
 * inventing three numbers to fill the space is exactly what D-6 exists to stop.
 */
export function HotelsPage({ lang }: HotelsPageProps) {
  const copy = copyFor(lang);
  const { filter, page, setFilter, nextPage } = useListSearch(path.hotels(lang));

  const query = useQuery(
    hotelsQuery(lang, {
      ...(filter === ALL ? {} : { filter }),
      perPage: page * PER_PAGE,
    }),
  );

  useDocumentMeta(
    {
      title: copy.hotels.metaTitle,
      description: copy.hotels.metaDescription,
      pathAfterLang: '/hotels',
    },
    lang,
  );

  const items = query.data?.items ?? [];
  const labels: Record<string, string> = copy.hotelFilters;

  return (
    <>
      <Breadcrumbs lang={lang} trail={[{ label: copy.hotels.breadcrumb }]} />

      <Section space="sm">
        <Container>
          <Eyebrow>{copy.brand}</Eyebrow>
          <Heading level={1} size="h1" className="mt-4">
            {copy.hotels.title}
          </Heading>
          <p className="mt-6 max-w-[620px] text-lead font-light text-body">{copy.hotels.lead}</p>
        </Container>
      </Section>

      <FilteredGrid
        lang={lang}
        filterLabel={copy.hotels.filterLabel}
        allLabel={copy.hotels.all}
        facets={query.data?.facets.categories ?? []}
        labelFor={(code) => labels[code] ?? code}
        value={filter}
        onValueChange={setFilter}
        shown={items.length}
        total={query.data?.meta.total ?? 0}
        hasMore={query.data?.meta.hasMore ?? false}
        onLoadMore={nextPage}
        isPending={query.isPending}
        isFetching={query.isFetching}
        isError={query.isError}
        onRetry={() => void query.refetch()}
      >
        <ul className="grid list-none grid-cols-3 gap-[26px] p-0 lap:grid-cols-2 mob:grid-cols-1">
          {items.map((hotel, index) => (
            <li key={hotel.id}>
              <HotelCard hotel={hotel} lang={lang} priority={index < 3} />
            </li>
          ))}
        </ul>
      </FilteredGrid>

      <Section space="sm" className="pb-section">
        <Container>
          <div className="grid grid-cols-[1.2fr_auto] items-center gap-[50px] rounded-block border border-line bg-surface p-13 tab:grid-cols-1 tab:gap-8 mob:p-8">
            <div>
              <Heading level={2} size="h2Sm">
                {copy.hotels.cta.title}
              </Heading>
              <p className="mt-4 max-w-[520px] text-bodySm font-light text-body">
                {copy.hotels.cta.text}
              </p>
            </div>
            <Link to={path.contact(lang)} className={buttonClass({ variant: 'solid' })}>
              {copy.hotels.cta.button}
            </Link>
          </div>
        </Container>
      </Section>
    </>
  );
}
