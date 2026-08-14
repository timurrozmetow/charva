import { type Lang } from '@charva/contracts';
import { Badge, buttonClass, Container, Eyebrow, Heading, ImageSlot, Section } from '@charva/ui';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

import { ziyaratPlaceQuery } from '../api/queries';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { QueryState } from '../components/QueryState';
import { ZiyaratCard } from '../components/ZiyaratCard';
import { copyFor } from '../i18n';
import { isNotFound } from '../lib/isNotFound';
import { path } from '../lib/routes';
import { useDocumentMeta } from '../lib/useDocumentMeta';

import { NotFoundPage } from './NotFoundPage';

export interface ZiyaratDetailPageProps {
  lang: Lang;
  slug: string;
}

/**
 * One place of ziyarat.
 *
 * The design has no such page — the cards on the route page are plain `<div>`s — but a place
 * with a name, a photograph, a description and a duration is a page, and it is the thing
 * somebody sends to the relative they are travelling with.
 *
 * «Golaýdaky ýerler» is the other places in the same city, which is what makes the page part of
 * an itinerary rather than a dead end.
 */
export function ZiyaratDetailPage({ lang, slug }: ZiyaratDetailPageProps) {
  const copy = copyFor(lang);
  const query = useQuery(ziyaratPlaceQuery(lang, slug));
  const place = query.data?.place;
  const cities: Record<string, string> = copy.cities;

  useDocumentMeta(
    {
      title: place === undefined ? copy.ziyarat.metaTitle : `${place.name} — ${copy.brand}`,
      description: place?.description ?? copy.ziyarat.metaDescription,
      pathAfterLang: `/ziyarat/${slug}`,
    },
    lang,
  );

  if (isNotFound(query.error)) return <NotFoundPage lang={lang} />;

  return (
    <>
      <Breadcrumbs
        lang={lang}
        trail={[
          { label: copy.ziyarat.breadcrumb, href: path.ziyarat(lang) },
          { label: place?.name ?? '…' },
        ]}
      />

      <Section space="sm">
        <Container>
          <QueryState
            lang={lang}
            isPending={query.isPending}
            isError={query.isError}
            onRetry={() => void query.refetch()}
            skeletonCount={1}
            skeletonClassName="h-[520px] rounded-panel"
          >
            {place !== undefined && (
              <article className="mx-auto max-w-[860px]">
                <Eyebrow>{cities[place.city] ?? place.city}</Eyebrow>
                <Heading level={1} size="h1" className="mt-4">
                  {place.name}
                </Heading>

                {place.durationLabel !== '' && (
                  <p className="mt-5 flex flex-wrap items-center gap-3 text-bodySm text-muted">
                    <span className="text-label font-bold uppercase">{copy.ziyarat.duration}</span>
                    <Badge variant="tint">{place.durationLabel}</Badge>
                  </p>
                )}

                <ImageSlot
                  slotKey={`u-place-${place.slug}`}
                  brief={place.name}
                  media={
                    place.cover === null
                      ? null
                      : {
                          src: place.cover.url,
                          alt: place.cover.alt,
                          ...(place.cover.lqip === null ? {} : { lqip: place.cover.lqip }),
                        }
                  }
                  ratio="16/9"
                  priority
                  className="mt-9 h-[440px] w-full rounded-panel mob:h-[220px]"
                />

                {place.description !== '' && (
                  <p className="mt-9 text-lead font-light leading-relaxed text-body">
                    {place.description}
                  </p>
                )}

                <div className="mt-10 flex flex-wrap gap-3">
                  <Link to={path.maksatnama(lang)} className={buttonClass()}>
                    {copy.ziyarat.cta.button}
                  </Link>
                  <Link to={path.ziyarat(lang)} className={buttonClass({ variant: 'outline' })}>
                    {copy.ziyarat.breadcrumb}
                  </Link>
                </div>
              </article>
            )}
          </QueryState>
        </Container>
      </Section>

      {(query.data?.nearby.length ?? 0) > 0 && (
        <Section space="md" className="pb-section-lg">
          <Container>
            <Heading level={2} size="h2Sm">
              {copy.ziyarat.nearbyTitle}
            </Heading>
            <ul className="mt-8 grid list-none grid-cols-3 gap-6 p-0 lap:grid-cols-2 mob:grid-cols-1">
              {(query.data?.nearby ?? []).map((nearby) => (
                <li key={nearby.id}>
                  <ZiyaratCard place={nearby} lang={lang} />
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      )}
    </>
  );
}
