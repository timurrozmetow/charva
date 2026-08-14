import { type Lang } from '@charva/contracts';
import { buttonClass, Container, Eyebrow, Heading, ImageSlot, Section } from '@charva/ui';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

import { packageQuery } from '../api/queries';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { QueryState } from '../components/QueryState';
import { copyFor, fill } from '../i18n';
import { formatDate } from '../lib/formatDate';
import { path } from '../lib/routes';
import { useDocumentMeta } from '../lib/useDocumentMeta';

export interface PackagePageProps {
  lang: Lang;
}

/**
 * The package.
 *
 * Four ordered lists of small labelled items — what is in it, the conditions, what the price
 * covers, and the order of signing up — which in a naive schema would be four tables with four
 * identical admin screens. They are four `block_code`s in `content_blocks` (D-17).
 *
 * There is no price on this page and there is nowhere for one to come from: the response schema
 * has no field for it, and `fastify-type-provider-zod` uses that schema as the serialiser, so a
 * careless `select *` is trimmed on the wire rather than «shouldn't happen» (D-12). The lead
 * says what the design says — ask the guide.
 *
 * The conditions table is where the handoff contradicts itself: «Dowamlylygy 10 gün — Mekgede 5,
 * Medinede 4 gün» is nine days, and the programme page lists ten. Both come from the same rows
 * now, so an editor fixing one has fixed both.
 */
export function PackagePage({ lang }: PackagePageProps) {
  const copy = copyFor(lang);
  const query = useQuery(packageQuery(lang));
  const data = query.data;

  useDocumentMeta(
    {
      title: copy.paket.metaTitle,
      description: copy.paket.metaDescription,
      pathAfterLang: '/paket',
    },
    lang,
  );

  const trip = data?.trip ?? null;
  const cover = data?.slots.find((slot) => slot.slotKey === 'u-pk-cover');

  return (
    <>
      <Breadcrumbs lang={lang} trail={[{ label: copy.paket.breadcrumb }]} />

      <Section space="sm">
        <Container>
          <Eyebrow>{copy.brand}</Eyebrow>
          <Heading level={1} size="h1" className="mt-4 max-w-[820px]">
            {copy.paket.title}
          </Heading>
          <p className="mt-6 max-w-[620px] text-lead font-light text-body">{copy.paket.lead}</p>
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
            skeletonClassName="h-[460px] rounded-panel"
          >
            <div className="grid grid-cols-[1fr_1.05fr] items-stretch gap-[26px] tab:grid-cols-1">
              <div
                data-surface="dark"
                className="rounded-panel border border-accent bg-dark-alt p-11 mob:p-6"
              >
                <Heading level={2} size="h2Sm">
                  {copy.paket.itemsTitle}
                </Heading>
                <ul className="mt-8 grid list-none grid-cols-2 gap-x-8 gap-y-3 p-0 mob:grid-cols-1">
                  {(data?.items ?? []).map((item) => (
                    <li key={item.id} className="flex gap-3 text-bodySm font-light text-body">
                      <span aria-hidden="true" className="text-accent-text">
                        ✦
                      </span>
                      {item.key === '' ? item.value : item.key}
                    </li>
                  ))}
                </ul>
                <Link to={path.yazylmak(lang)} className={buttonClass({ className: 'mt-9' })}>
                  {copy.paket.cta}
                </Link>
              </div>

              <ImageSlot
                slotKey="u-pk-cover"
                brief={cover?.brief ?? copy.paket.title}
                media={cover?.media == null ? null : { src: cover.media.url, alt: cover.media.alt }}
                ratio="4/3"
                className="min-h-[460px] w-full rounded-panel"
              />
            </div>

            <Heading level={2} size="h2Sm" className="mt-20">
              {copy.paket.conditionsTitle}
            </Heading>
            <dl className="mt-8 overflow-hidden rounded-block border border-line bg-surface">
              {/*
                One departure, one row, every date.

                In the prototype eight of these values are typed into the markup, and the same
                `18.09.2026` appears in three other files. Two of them are rendered from the
                trip so a change to `depart_at` in the admin moves the whole site.
              */}
              {trip !== null && (
                <>
                  <Row label={copy.trip.departOn} value={formatDate(trip.departAt) ?? ''} />
                  <Row label={copy.trip.returnOn} value={formatDate(trip.returnAt) ?? ''} />
                  <Row
                    label={copy.trip.duration}
                    value={fill(copy.common.days.other, { count: trip.durationDays })}
                  />
                </>
              )}
              {(data?.conditions ?? []).map((row) => (
                <Row key={row.id} label={row.key} value={row.value} />
              ))}
            </dl>

            <div className="mt-20 grid grid-cols-2 gap-[26px] tab:grid-cols-1">
              <div>
                <Heading level={2} size="h2Sm">
                  {copy.paket.includedTitle}
                </Heading>
                <ul className="mt-8 flex list-none flex-col p-0">
                  {(data?.included ?? []).map((item) => (
                    <li
                      key={item.id}
                      className="flex gap-3 border-t border-line py-4 text-body font-light text-body"
                    >
                      <span aria-hidden="true" className="text-accent-text">
                        ✦
                      </span>
                      {item.key === '' ? item.value : item.key}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <Heading level={2} size="h2Sm">
                  {copy.paket.orderTitle}
                </Heading>
                <ol className="mt-8 flex list-none flex-col gap-6 p-0">
                  {(data?.signupOrder ?? []).map((step, index) => (
                    <li key={step.id} className="flex gap-4">
                      <span aria-hidden="true" className="w-[34px] shrink-0 text-h3 text-accent">
                        {/* The editor's own number when there is one, the position otherwise —
                            never both, and never a second list to keep in step. */}
                        {step.note === '' ? String(index + 1).padStart(2, '0') : step.note}
                      </span>
                      <div>
                        <h3 className="text-body font-semibold text-ink">{step.key}</h3>
                        <p className="mt-1 text-bodySm font-light text-body">{step.value}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </QueryState>
        </Container>
      </Section>
    </>
  );
}

/** One row of the conditions table. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[1fr_1.6fr] gap-[30px] border-t border-line px-8 py-[18px] mob:grid-cols-1 mob:gap-1">
      <dt className="text-label font-bold uppercase text-muted">{label}</dt>
      <dd className="text-body text-ink">{value}</dd>
    </div>
  );
}
