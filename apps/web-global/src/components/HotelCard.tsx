import { formatMoney, type HotelCard as HotelCardData, type Lang } from '@charva/contracts';
import { Badge, cardClass, ImageSlot, StarRating } from '@charva/ui';
import { Link } from '@tanstack/react-router';

import { copyFor, fill } from '../i18n';
import { path } from '../lib/routes';

export interface HotelCardProps {
  hotel: HotelCardData;
  lang: Lang;
  priority?: boolean;
}

/**
 * One hotel.
 *
 * Different from the tour card in the ways the design makes them different: the pill shows the
 * *city* rather than a tag, the amenities are a row of chips, and the footer reads «ночь от».
 *
 * `stars` and `category` are separate fields, and this is the card where that matters. The
 * prototype gives the yurt camp a display string of «Юрта» and a filter key of «Кемп», and the
 * boutique «Бутик» for both — two facts about one row that cannot both be true. Here a camp has
 * no stars at all, so there is nothing to contradict.
 */
export function HotelCard({ hotel, lang, priority = false }: HotelCardProps) {
  const copy = copyFor(lang);
  const headingId = `hotel-${String(hotel.id)}`;

  return (
    <article className={cardClass({ interactive: true })}>
      <Link
        to={path.hotel(lang, hotel.slug)}
        aria-labelledby={headingId}
        className="block no-underline"
      >
        <div className="relative">
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
            ratio="4/3"
            priority={priority}
            className="h-[220px] w-full rounded-media"
          />

          {hotel.city !== '' && (
            <Badge variant="scrim" className="absolute left-4 top-4">
              {hotel.city}
            </Badge>
          )}
        </div>

        <div className="flex flex-col gap-3 px-5 pb-6 pt-5">
          {/* Null for a camp and a boutique, which is the whole point of the pair. */}
          {hotel.stars !== null && (
            <StarRating
              value={hotel.stars}
              label={fill(copy.common.stars, { count: hotel.stars })}
            />
          )}

          <h3 id={headingId} className="text-cardTitle font-medium text-ink">
            {hotel.name}
          </h3>

          {hotel.summary !== '' && <p className="text-bodySm text-body">{hotel.summary}</p>}

          {hotel.amenities.length > 0 && (
            <ul className="flex list-none flex-wrap gap-2 p-0">
              {hotel.amenities.slice(0, 3).map((amenity) => (
                <li
                  key={amenity.code}
                  className="rounded-full bg-line-soft px-3 py-1.5 text-label font-semibold text-body"
                >
                  {amenity.name}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-1 text-bodySm text-muted">
            {copy.common.perNight} {copy.common.from}{' '}
            <span className="text-cardTitle font-medium text-ink">
              {formatMoney(hotel.priceFrom)}
            </span>
          </p>
        </div>
      </Link>
    </article>
  );
}
