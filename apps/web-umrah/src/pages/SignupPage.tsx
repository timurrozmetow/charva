import { type Lang } from '@charva/contracts';
import { Container, Eyebrow, Heading, ImageSlot, Section, Skeleton } from '@charva/ui';
import { useQuery } from '@tanstack/react-query';

import { settingsQuery, tripQuery } from '../api/queries';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { SignupForm } from '../components/SignupForm';
import { copyFor, fill } from '../i18n';
import { formatDate } from '../lib/formatDate';
import { useDocumentMeta } from '../lib/useDocumentMeta';

export interface SignupPageProps {
  lang: Lang;
}

/** Whole days until a moment, floored — the same rounding the countdown uses. */
function daysUntil(iso: string, now: number): number {
  return Math.max(0, Math.floor((new Date(iso).getTime() - now) / 86_400_000));
}

/**
 * The signup page.
 *
 * `daysLeft` in the prototype is computed inside `render` with no timer and no state, so it is
 * correct once and never again — a tab left open over midnight shows yesterday's number
 * forever. It also uses `Math.ceil` while the homepage uses `Math.floor`, so the same departure
 * is «38 gün» on one page and «37» on the other. Here both numbers come from the same trip and
 * the same rounding, and the badge is rendered from `seatsLeft`, which is one column.
 *
 * The summary carries no price, and there is nowhere for one to come from: the response schema
 * has no field for it. The prototype computes `total` and a 30% deposit from a hardcoded
 * `8 575 TMT` and then never renders either — dead code that agrees with «no prices» by
 * accident. It is deleted rather than commented out (D-9).
 */
export function SignupPage({ lang }: SignupPageProps) {
  const copy = copyFor(lang);
  const trip = useQuery(tripQuery(lang));
  const settings = useQuery(settingsQuery(lang));

  useDocumentMeta({ route: 'yazylmak', pathAfterLang: '/yazylmak' }, lang);

  const current = trip.data?.trip ?? null;
  const contacts = settings.data?.contacts;
  const isOpen = current?.signupOpen ?? false;

  const rows: { key: keyof typeof copy.yazylmak.labels; value: string; href: string }[] = [
    {
      key: 'phone',
      value: contacts?.phone ?? '',
      href: `tel:${(contacts?.phone ?? '').replace(/[^\d+]/g, '')}`,
    },
    // The desk has a second line. On the page where somebody is deciding to hand over a
    // passport, one number that does not answer is a reason to close the tab.
    ...(contacts?.phoneAlt === undefined || contacts.phoneAlt === ''
      ? []
      : [
          {
            key: 'phoneAlt' as const,
            value: contacts.phoneAlt,
            href: `tel:${contacts.phoneAlt.replace(/[^\d+]/g, '')}`,
          },
        ]),
    {
      key: 'whatsapp',
      value: contacts?.whatsapp ?? '',
      href: `https://wa.me/${(contacts?.whatsapp ?? '').replace(/\D/g, '')}`,
    },
    { key: 'email', value: contacts?.email ?? '', href: `mailto:${contacts?.email ?? ''}` },
    { key: 'hours', value: contacts?.hours ?? '', href: '' },
  ];

  return (
    <>
      <Breadcrumbs lang={lang} trail={[{ label: copy.yazylmak.breadcrumb }]} />

      <Section space="sm">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <Eyebrow>{copy.brand}</Eyebrow>
              <Heading level={1} size="h1" className="mt-4">
                {copy.yazylmak.title}
              </Heading>
              <p className="mt-6 max-w-[560px] text-lead font-light text-body">
                {copy.yazylmak.lead}
              </p>
            </div>

            {current !== null && isOpen && (
              <p className="inline-flex items-center gap-2 rounded-full border border-tint-line bg-tint px-5 py-3 text-label font-black uppercase text-accent-active">
                <span
                  aria-hidden="true"
                  className="size-[7px] animate-pulse rounded-full bg-accent"
                />
                {fill(copy.yazylmak.badge, {
                  left: current.seatsLeft,
                  // Read once per render from the same clock the countdown uses. The badge is
                  // a rounded day count, not a ticking one — a live seconds display here would
                  // be noise beside a form somebody is typing into.
                  days: daysUntil(current.departAt, Date.now()),
                })}
              </p>
            )}
          </div>

          <div className="mt-13 grid grid-cols-[1.15fr_1fr] items-start gap-[26px] tab:grid-cols-1">
            <div className="rounded-panel border border-line bg-surface p-11 mob:p-6">
              {current !== null && (
                <div className="mb-8 rounded-panel-sm border border-tint-line bg-tint-soft px-6 py-5">
                  <p className="text-label font-black uppercase text-accent-text">
                    {copy.yazylmak.summaryTitle}
                  </p>
                  <p className="mt-2 text-body text-ink">
                    {formatDate(current.departAt)} — {formatDate(current.returnAt)} ·{' '}
                    {fill(copy.common.days.other, { count: current.durationDays })}
                  </p>
                </div>
              )}

              {trip.isPending ? (
                <Skeleton className="h-[420px] w-full rounded-panel-sm" />
              ) : current === null ? (
                <>
                  <Heading level={2} size="h3">
                    {copy.yazylmak.closedTitle}
                  </Heading>
                  <p className="mt-3 text-body font-light text-body">{copy.yazylmak.closedText}</p>
                  {/* Still a form. «No departure announced» is the state where somebody most
                      wants to be told when there is one, and a page that offers nothing to do
                      loses them. The API stores it as a signup against the next trip. */}
                  <SignupForm lang={lang} open={false} className="mt-8" />
                </>
              ) : (
                <SignupForm lang={lang} open={isOpen} />
              )}
            </div>

            <div className="flex flex-col gap-[26px]">
              {current !== null && (
                <div
                  data-surface="dark"
                  className="rounded-panel bg-dark p-10 text-dark-on mob:p-6"
                >
                  <p className="text-label font-black uppercase tracking-[0.3em] text-accent-text">
                    {copy.yazylmak.summaryTitle}
                  </p>
                  <Heading level={2} size="h3" className="mt-3">
                    {copy.paket.title}
                  </Heading>

                  <dl className="mt-7">
                    <SummaryRow
                      label={copy.trip.departOn}
                      value={formatDate(current.departAt) ?? ''}
                    />
                    <SummaryRow
                      label={copy.trip.returnOn}
                      value={formatDate(current.returnAt) ?? ''}
                    />
                    <SummaryRow
                      label={copy.trip.duration}
                      value={fill(copy.common.days.other, { count: current.durationDays })}
                    />
                    {current.hotelMekka !== '' && (
                      <SummaryRow label={copy.trip.hotel} value={current.hotelMekka} />
                    )}
                  </dl>

                  <p className="mt-6 text-bodySm font-light text-muted">
                    {copy.yazylmak.summaryNote}
                  </p>
                </div>
              )}

              <div className="rounded-panel border border-line bg-surface p-9 mob:p-6">
                <p className="text-label font-bold uppercase text-muted">
                  {copy.yazylmak.contactsTitle}
                </p>
                <dl className="mt-5">
                  {rows
                    .filter((row) => row.value !== '')
                    .map((row) => (
                      <div
                        key={row.key}
                        className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line py-3"
                      >
                        <dt className="text-bodySm text-muted">{copy.yazylmak.labels[row.key]}</dt>
                        <dd className="text-bodySm font-medium text-ink">
                          {row.href === '' ? (
                            row.value
                          ) : (
                            <a
                              href={row.href}
                              className="transition-colors duration-colour hover:text-accent-text"
                            >
                              {row.value}
                            </a>
                          )}
                        </dd>
                      </div>
                    ))}
                </dl>
              </div>

              <ImageSlot
                slotKey="u-signup-side"
                brief={copy.yazylmak.title}
                media={null}
                ratio="4/3"
                className="min-h-[240px] w-full rounded-panel"
              />
            </div>
          </div>
        </Container>
      </Section>

      <div className="pb-section-lg" />
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-line py-3">
      <dt className="text-bodySm text-muted">{label}</dt>
      <dd className="text-bodySm font-semibold text-ink">{value}</dd>
    </div>
  );
}
