import { type Lang } from '@charva/contracts';
import { buttonClass, Container, Eyebrow, Heading, ImageSlot, Section } from '@charva/ui';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

import { countryQuery } from '../api/queries';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { QueryState } from '../components/QueryState';
import { copyFor } from '../i18n';
import { path } from '../lib/routes';
import { useDocumentMeta } from '../lib/useDocumentMeta';

export interface CountryPageProps {
  lang: Lang;
}

/**
 * The country page: facts, the visa, and what to see.
 *
 * The eight facts and the four visa steps are rows in `content_blocks` — one table for seven
 * small ordered lists that would otherwise have been seven tables with seven identical admin
 * screens (D-17). The homepage repeats seven of the same eight facts, and the only difference
 * between the two lists is a flag on the row.
 */
export function CountryPage({ lang }: CountryPageProps) {
  const copy = copyFor(lang);
  const query = useQuery(countryQuery(lang));

  useDocumentMeta({ route: 'country', pathAfterLang: '/turkmenistan' }, lang);

  return (
    <>
      <Breadcrumbs lang={lang} trail={[{ label: copy.country.breadcrumb }]} />

      <Section space="sm">
        <Container>
          <Eyebrow>{copy.brand}</Eyebrow>
          <Heading level={1} size="h1" className="mt-4 max-w-[900px]">
            {copy.country.title}
          </Heading>
          <p className="mt-6 max-w-[620px] text-lead font-light text-body">{copy.country.lead}</p>
        </Container>
      </Section>

      <Section space="md">
        <Container>
          <QueryState
            lang={lang}
            isPending={query.isPending}
            isError={query.isError}
            onRetry={() => void query.refetch()}
            skeletonCount={2}
            skeletonClassName="h-[420px] rounded-panel"
          >
            <div className="grid grid-cols-2 gap-20 tab:grid-cols-1 tab:gap-12">
              <div>
                <Heading level={2} size="h2Sm">
                  {copy.country.factsTitle}
                </Heading>
                <dl className="mt-8">
                  {(query.data?.facts ?? []).map((fact) => (
                    <div
                      key={fact.id}
                      className="grid grid-cols-fact gap-5 border-b border-line py-[17px] mob:grid-cols-1 mob:gap-1"
                    >
                      <dt className="text-bodySm text-muted">{fact.key}</dt>
                      <dd className="text-body text-ink">{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="h-fit rounded-block border border-line bg-surface p-11 mob:p-6">
                <Heading level={2} size="h2Sm">
                  {copy.country.visaTitle}
                </Heading>
                <ol className="mt-8 flex list-none flex-col gap-6 p-0">
                  {(query.data?.visaSteps ?? []).map((step, index) => (
                    <li key={step.id} className="flex gap-4">
                      <span aria-hidden="true" className="text-label font-black text-accent-text">
                        {/* The number comes from the row's own `note` when the editor set one,
                            and from its position otherwise — never from both. */}
                        {step.note === '' ? String(index + 1).padStart(2, '0') : step.note}
                      </span>
                      <div>
                        <h3 className="text-body font-semibold text-ink">{step.key}</h3>
                        <p className="mt-1 text-bodySm font-light text-body">{step.value}</p>
                      </div>
                    </li>
                  ))}
                </ol>

                <Link
                  to={path.contact(lang)}
                  className={buttonClass({ variant: 'solid', className: 'mt-8' })}
                >
                  {copy.country.visaCta}
                </Link>
              </div>
            </div>
          </QueryState>
        </Container>
      </Section>

      <Section space="md" className="pb-section">
        <Container>
          <Heading level={2} size="h2">
            {copy.country.placesTitle}
          </Heading>

          <ul className="mt-10 grid list-none grid-cols-3 gap-6 p-0 lap:grid-cols-2 mob:grid-cols-1">
            {(query.data?.places ?? []).map((place) => (
              <li key={place.id}>
                <article className="flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface">
                  <ImageSlot
                    slotKey={`place-cover-${place.slug}`}
                    brief={place.name}
                    media={
                      place.cover === null ? null : { src: place.cover.url, alt: place.cover.alt }
                    }
                    ratio="16/10"
                    className="h-[200px] w-full"
                  />
                  <div className="flex flex-col gap-2 p-6">
                    {place.region !== '' && <Eyebrow>{place.region}</Eyebrow>}
                    <h3 className="text-cardTitle font-medium text-ink">{place.name}</h3>
                    {place.description !== '' && (
                      <p className="text-bodySm font-light text-body">{place.description}</p>
                    )}
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </Container>
      </Section>
    </>
  );
}
