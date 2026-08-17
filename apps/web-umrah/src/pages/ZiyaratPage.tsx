import { type Lang } from '@charva/contracts';
import {
  Button,
  buttonClass,
  Chip,
  Container,
  EmptyState,
  Eyebrow,
  Heading,
  Section,
} from '@charva/ui';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback } from 'react';

import { ziyaratQuery } from '../api/queries';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { QueryState } from '../components/QueryState';
import { ZiyaratCard } from '../components/ZiyaratCard';
import { copyFor, fill } from '../i18n';
import { path } from '../lib/routes';
import { useDocumentMeta } from '../lib/useDocumentMeta';

export interface ZiyaratPageProps {
  lang: Lang;
}

const ALL = 'all';

/**
 * The places of ziyarat.
 *
 * Three corrections, and the first is the reason decision D-15 exists at all.
 *
 * **The chips come from the data.** The prototype hardcodes `['Ählisi', 'Mekge', 'Medine',
 * 'Bedir']` while its own list contains a place in Jidda — so a ninth of the places is
 * unreachable by any filter, and nobody would ever notice from the code. Here the cities are
 * counted by the API from published rows, which makes both failures unrepresentable: no chip
 * can lead to an empty grid, and no city can be missing a chip.
 *
 * **The counter is counted.** «Görkezildi {{shownCount}} / 9» has its denominator typed in.
 *
 * **The H1 is Turkmen.** In the handoff it reads «Куда мы пойдём» — Russian, on a Turkmen page,
 * while the navigation calls the same section `Ziýarat ýerleri`. Question Q-3.
 */
export function ZiyaratPage({ lang }: ZiyaratPageProps) {
  const copy = copyFor(lang);
  const navigate = useNavigate();
  const search: Record<string, unknown> = useSearch({ strict: false });

  const raw = search['city'];
  const city = typeof raw === 'string' && raw !== '' ? raw : ALL;

  const setCity = useCallback(
    (value: string) => {
      void navigate({
        to: path.ziyarat(lang),
        // The default never reaches the address bar: one page, one address.
        search: value === ALL ? {} : { city: value },
        replace: true,
      });
    },
    [navigate, lang],
  );

  const query = useQuery(ziyaratQuery(lang, city === ALL ? undefined : city));

  useDocumentMeta({ route: 'ziyarat', pathAfterLang: '/ziyarat' }, lang);

  const items = query.data?.items ?? [];
  const facets = query.data?.facets.cities ?? [];
  const cities: Record<string, string> = copy.cities;
  const total = facets.reduce((sum, facet) => sum + facet.count, 0);

  return (
    <>
      <Breadcrumbs lang={lang} trail={[{ label: copy.ziyarat.breadcrumb }]} />

      <Section space="sm">
        <Container>
          <Eyebrow>{copy.brand}</Eyebrow>
          <Heading level={1} size="h1" className="mt-4 max-w-[820px]">
            {copy.ziyarat.title}
          </Heading>
          <p className="mt-6 max-w-[620px] text-lead font-light text-body">{copy.ziyarat.lead}</p>

          <div
            role="group"
            aria-label={copy.ziyarat.filterLabel}
            className="mt-13 flex flex-wrap items-center gap-[9px] border-t border-line pt-8"
          >
            <Chip
              active={city === ALL}
              count={total}
              onClick={() => {
                setCity(ALL);
              }}
            >
              {copy.ziyarat.all}
            </Chip>
            {facets.map((facet) => (
              <Chip
                key={facet.code}
                active={city === facet.code}
                count={facet.count}
                onClick={() => {
                  setCity(facet.code);
                }}
              >
                {cities[facet.code] ?? facet.code}
              </Chip>
            ))}
            <p className="ml-auto text-bodySm text-muted">
              {fill(copy.common.shown, { shown: items.length, total })}
            </p>
          </div>
        </Container>
      </Section>

      <Section space="sm">
        <Container>
          <QueryState
            lang={lang}
            isPending={query.isPending}
            isError={query.isError}
            onRetry={() => void query.refetch()}
            skeletonCount={6}
            skeletonClassName="h-[420px] rounded-card"
          >
            {items.length === 0 ? (
              <EmptyState
                title={copy.common.nothingFound}
                description={copy.common.nothingFoundHint}
                action={
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCity(ALL);
                    }}
                  >
                    {copy.ziyarat.all}
                  </Button>
                }
              />
            ) : (
              <ul className="grid list-none grid-cols-3 gap-6 p-0 lap:grid-cols-2 mob:grid-cols-1">
                {items.map((place) => (
                  <li key={place.id}>
                    <ZiyaratCard place={place} lang={lang} />
                  </li>
                ))}
              </ul>
            )}
          </QueryState>
        </Container>
      </Section>

      <Section space="md" className="pb-section-lg">
        <Container>
          <div
            data-surface="dark"
            className="grid grid-cols-[1.2fr_auto] items-center gap-[50px] rounded-block bg-dark-alt p-13 tab:grid-cols-1 tab:gap-8 mob:p-8"
          >
            <Heading level={2} size="h2Sm">
              {copy.ziyarat.cta.title}
            </Heading>
            <Link to={path.maksatnama(lang)} className={buttonClass()}>
              {copy.ziyarat.cta.button}
            </Link>
          </div>
        </Container>
      </Section>
    </>
  );
}
