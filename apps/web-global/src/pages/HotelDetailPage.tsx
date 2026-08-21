import { formatMoney, type Lang } from '@charva/contracts';
import {
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
import { HotelEquipment, HotelFacts, HotelShowcase } from '../components/HotelShowcase';
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
      route: 'hotels',
      pathAfterLang: `/hotels/${slug}`,
      ...(hotel === undefined ? {} : { content: { name: hotel.name, summary: hotel.summary } }),
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
                {/* The class and the stars are the same fact twice, so the words carry the
                    class and the stars are drawn: «АШХАБАД · ОТЕЛЬ» over ★★★★★. */}
                <Eyebrow>
                  {hotel.city} · {filters[hotel.filterKey] ?? hotel.filterKey}
                </Eyebrow>

                {hotel.stars !== null && (
                  <div className="mt-4">
                    <StarRating
                      value={hotel.stars}
                      label={fill(copy.common.stars, { count: hotel.stars })}
                    />
                  </div>
                )}

                {hotel.summary !== '' && (
                  <p className="mt-5 max-w-[620px] text-lead font-light text-body">
                    {hotel.summary}
                  </p>
                )}

                {/*
                  The photographs first, then the name and the price beside it, then the facts.

                  A hotel is chosen by looking at it. The page used to open on one 480-pixel
                  cover with everything else — the class, the city, the price — in a table
                  further down, which is the order a database row happens to be in rather than
                  the order a person asks the questions.
                */}
                <div className="mt-11">
                  <HotelShowcase hotel={hotel} lang={lang} />
                </div>

                <div className="mt-9 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-b border-line pb-7">
                  <Heading level={1} size="h2">
                    {hotel.name}
                  </Heading>
                  <p className="m-0 text-body font-light text-muted">
                    {copy.common.from}{' '}
                    <span className="text-h3 font-medium text-accent-text">
                      {formatMoney(hotel.priceFrom)}
                    </span>{' '}
                    {copy.hotel.perNight}
                  </p>
                </div>

                <div className="py-9">
                  <HotelFacts hotel={hotel} lang={lang} />
                </div>

                <HotelEquipment hotel={hotel} lang={lang} />

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

                    {/* The same gallery a tour has, because it is the same thing: a handful of
                        photographs beside the cover. A hotel used to show one picture of a
                        building and nothing of the rooms, the restaurant or the view. */}
                    {hotel.gallery.length > 0 && (
                      <>
                        <Heading level={2} size="h2Sm" className="mt-16">
                          {copy.hotel.galleryTitle}
                        </Heading>
                        <ul className="mt-8 grid list-none grid-cols-2 gap-6 p-0 mob:grid-cols-1">
                          {hotel.gallery.map((shot) => (
                            <li key={shot.media.url}>
                              <ImageSlot
                                slotKey={`hotel-gallery-${hotel.slug}`}
                                brief={shot.caption}
                                media={{ src: shot.media.url, alt: shot.media.alt }}
                                ratio="4/3"
                                className="h-[240px] w-full rounded-media"
                              />
                              {shot.caption !== '' && (
                                <p className="mt-3 text-bodySm text-muted">{shot.caption}</p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}

                    {hotel.rooms.length > 0 && (
                      <>
                        <Heading level={2} size="h2Sm" className="mt-16">
                          {copy.hotel.roomsTitle}
                        </Heading>
                        {/*
                          What kind of room, for how many, at what price.

                          The hotel used to say one number and nothing else — «от 96 $ за ночь» —
                          which is the only figure a single price column can hold. A room without
                          its own price shows the hotel's, because that is what the null means:
                          «this hotel quotes one rate», not «this room is free».
                        */}
                        <ul className="mt-8 flex list-none flex-col gap-0 p-0">
                          {hotel.rooms.map((room, index) => (
                            <li
                              key={`${room.code}-${String(index)}`}
                              className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line py-4"
                            >
                              <span className="text-body font-medium text-ink">{room.name}</span>
                              <span className="flex-1 text-bodySm font-light text-muted">
                                {[
                                  fill(copy.hotel.roomCapacity, { count: room.capacity }),
                                  room.sizeSqm === null
                                    ? null
                                    : fill(copy.hotel.roomSize, { size: room.sizeSqm }),
                                  room.description === '' ? null : room.description,
                                ]
                                  .filter((part) => part !== null)
                                  .join(' · ')}
                              </span>
                              <span className="text-body font-medium text-accent-text">
                                {copy.common.from} {formatMoney(room.price ?? hotel.priceFrom)}
                              </span>
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

                    {/* No table of city, class and stars here any more: all three are above
                        the fold now, and repeating them made the aside a second, worse copy of
                        the page. What is left is what the aside is for — the price and the
                        two ways to act on it. */}

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

      <Section tone="dark" space="md" id="enquiry">
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
