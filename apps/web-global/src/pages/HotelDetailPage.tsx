import { formatMoney, type Lang } from '@charva/contracts';
import {
  Badge,
  buttonClass,
  Container,
  Eyebrow,
  Heading,
  ImageSlot,
  Section,
  StarRating,
} from '@charva/ui';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

import { hotelQuery } from '../api/queries';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { LeadForm } from '../components/LeadForm';
import { Prose } from '../components/Prose';
import { QueryState } from '../components/QueryState';
import { copyFor, fill } from '../i18n';
import { isNotFound } from '../lib/isNotFound';
import { path } from '../lib/routes';
import { useDocumentMeta } from '../lib/useDocumentMeta';

import { NotFoundPage } from './NotFoundPage';

export interface HotelDetailPageProps {
  lang: Lang;
  slug: string;
}

/**
 * One hotel.
 *
 * Shorter than a tour, because a hotel row is shorter: there is no itinerary and no gallery
 * table behind it, so the page is a cover, a description, the amenity list as words rather than
 * three chips, and the enquiry.
 *
 * The class line is the pair `stars` and `category` doing its job in the open. A camp shows
 * «Кемп» and no stars at all; the prototype's card shows a yurt camp as «3★» while its filter
 * calls the same row «Кемп», and the reason that cannot happen here is that there is no star
 * value to print.
 */
export function HotelDetailPage({ lang, slug }: HotelDetailPageProps) {
  const copy = copyFor(lang);
  const query = useQuery(hotelQuery(lang, slug));
  const hotel = query.data;
  const filters: Record<string, string> = copy.hotelFilters;

  useDocumentMeta(
    {
      title: hotel === undefined ? copy.hotels.metaTitle : `${hotel.name} — ${copy.brand}`,
      description: hotel?.summary ?? copy.hotels.metaDescription,
      pathAfterLang: `/hotels/${slug}`,
    },
    lang,
  );

  if (isNotFound(query.error)) return <NotFoundPage lang={lang} />;

  return (
    <>
      <Breadcrumbs
        lang={lang}
        trail={[
          { label: copy.hotel.breadcrumb, href: path.hotels(lang) },
          { label: hotel?.name ?? '…' },
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
            {hotel !== undefined && (
              <>
                <Eyebrow>{hotel.city}</Eyebrow>
                <Heading level={1} size="h1" className="mt-4 max-w-[900px]">
                  {hotel.name}
                </Heading>

                {hotel.stars !== null && (
                  <div className="mt-5">
                    <StarRating
                      value={hotel.stars}
                      label={fill(copy.common.stars, { count: hotel.stars })}
                    />
                  </div>
                )}

                {hotel.summary !== '' && (
                  <p className="mt-6 max-w-[620px] text-lead font-light text-body">
                    {hotel.summary}
                  </p>
                )}

                <div className="relative mt-11">
                  <ImageSlot
                    slotKey={`hotel-cover-${hotel.slug}`}
                    brief={hotel.name}
                    media={
                      hotel.cover === null
                        ? null
                        : {
                            src: hotel.cover.url,
                            alt: hotel.cover.alt,
                            ...(hotel.cover.lqip === null ? {} : { lqip: hotel.cover.lqip }),
                            ...(hotel.cover.width === null ? {} : { width: hotel.cover.width }),
                            ...(hotel.cover.height === null ? {} : { height: hotel.cover.height }),
                          }
                    }
                    ratio="16/9"
                    priority
                    className="h-[480px] w-full rounded-panel lap:h-[360px] mob:h-[220px]"
                  />
                  <Badge variant="scrim" className="absolute left-6 top-6">
                    {filters[hotel.filterKey] ?? hotel.filterKey}
                  </Badge>
                </div>

                <div className="mt-12 grid grid-cols-[1fr_360px] items-start gap-16 lap:gap-10 tab:grid-cols-1">
                  <div>
                    {hotel.body !== '' && (
                      <>
                        <Heading level={2} size="h2Sm">
                          {copy.hotel.aboutTitle}
                        </Heading>
                        <Prose text={hotel.body} className="mt-6" />
                      </>
                    )}

                    {hotel.amenities.length > 0 && (
                      <>
                        <Heading level={2} size="h2Sm" className="mt-16">
                          {copy.hotel.amenitiesTitle}
                        </Heading>
                        {/*
                          All of them, as a list.

                          The card shows three because a card has room for three; a page that
                          also stopped at three would be hiding what the row actually says. The
                          names come from the `amenities` table rather than from a JSON array of
                          Russian strings, which is what makes them translatable at all.
                        */}
                        <ul className="mt-8 grid list-none grid-cols-2 gap-x-10 gap-y-0 p-0 mob:grid-cols-1">
                          {hotel.amenities.map((amenity) => (
                            <li
                              key={amenity.code}
                              className="border-b border-line py-4 text-body font-light text-body"
                            >
                              {amenity.name}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>

                  <aside className="sticky top-28 rounded-block border border-line bg-surface p-8 tab:static mob:p-6">
                    <p className="text-label font-bold uppercase text-muted">
                      {copy.hotel.priceLabel}
                    </p>
                    <p className="mt-2 text-h2Sm font-medium text-ink">
                      {copy.common.from} {formatMoney(hotel.priceFrom)}
                    </p>
                    <p className="mt-2 text-bodySm font-light text-muted">{copy.hotel.priceNote}</p>

                    <dl className="mt-7">
                      <div className="flex items-center justify-between gap-4 border-b border-line py-3">
                        <dt className="text-bodySm text-muted">{copy.hotel.facts.city}</dt>
                        <dd className="text-bodySm font-medium text-ink">{hotel.city}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4 border-b border-line py-3">
                        <dt className="text-bodySm text-muted">{copy.hotel.facts.category}</dt>
                        <dd className="text-bodySm font-medium text-ink">
                          {filters[hotel.filterKey] ?? hotel.filterKey}
                        </dd>
                      </div>
                      {hotel.stars !== null && (
                        <div className="flex items-center justify-between gap-4 border-b border-line py-3">
                          <dt className="text-bodySm text-muted">{copy.hotel.facts.stars}</dt>
                          <dd className="text-bodySm font-medium text-ink">
                            {String(hotel.stars)}
                          </dd>
                        </div>
                      )}
                    </dl>

                    <a
                      href="#enquiry"
                      className={buttonClass({ fullWidth: true, className: 'mt-8' })}
                    >
                      {copy.hotel.formTitle}
                    </a>
                    <Link
                      to={path.hotels(lang)}
                      className={buttonClass({
                        variant: 'outline',
                        fullWidth: true,
                        className: 'mt-3',
                      })}
                    >
                      {copy.hotel.allHotels}
                    </Link>
                  </aside>
                </div>
              </>
            )}
          </QueryState>
        </Container>
      </Section>

      <Section tone="dark" space="md" id="enquiry" className="mt-16">
        <Container>
          <div className="grid grid-cols-[1fr_1.1fr] items-start gap-16 tab:grid-cols-1 tab:gap-10">
            <div>
              <Heading level={2} size="h2">
                {copy.hotel.formTitle}
              </Heading>
              <p className="mt-5 max-w-[460px] text-lead font-light text-body">
                {copy.hotel.formLead}
              </p>
            </div>
            <LeadForm
              lang={lang}
              kind="tour"
              {...(hotel === undefined ? {} : { contextTitle: hotel.name })}
              showTopics={false}
              className="rounded-panel border border-line bg-surface p-11 mob:p-6"
            />
          </div>
        </Container>
      </Section>
    </>
  );
}
