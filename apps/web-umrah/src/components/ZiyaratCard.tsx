import { type Lang, type ZiyaratPlace } from '@charva/contracts';
import { Badge, cardClass, ImageSlot } from '@charva/ui';
import { Link } from '@tanstack/react-router';

import { copyFor } from '../i18n';
import { path } from '../lib/routes';

export interface ZiyaratCardProps {
  place: ZiyaratPlace;
  lang: Lang;
}

/**
 * One place of ziyarat.
 *
 * Two corrections against the handoff, both structural.
 *
 * **It is a link.** On the homepage the same card is an `<a>` pointing at the route page; on the
 * route page itself the cards are plain `<div>`s, because no detail page was ever drawn. One of
 * the two had to be wrong, and it was the `<div>`: a place with a name, a description, a photo
 * and a duration is a page.
 *
 * **There is no `pack` line.** The design's footer carries «Ähli paketde» / «Plus we VIP» / «VIP»
 * — a leftover of three tariffs that README §5 says do not exist. With one package the column
 * says nothing at all, and leaving it would be leaving the words «VIP» on a page whose whole
 * point is that there is one pilgrimage and one price nobody quotes (D-9).
 */
export function ZiyaratCard({ place, lang }: ZiyaratCardProps) {
  const copy = copyFor(lang);
  const headingId = `place-${String(place.id)}`;
  const cities: Record<string, string> = copy.cities;

  return (
    <article className={cardClass({ interactive: true })}>
      <Link
        to={path.ziyaratPlace(lang, place.slug)}
        aria-labelledby={headingId}
        className="flex h-full flex-col no-underline"
      >
        <div className="relative">
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
            ratio="4/3"
            className="h-[230px] w-full rounded-media"
          />
          <Badge variant="scrim" className="absolute left-4 top-4">
            {cities[place.city] ?? place.city}
          </Badge>
        </div>

        <div className="flex flex-1 flex-col gap-3 px-[26px] pb-[30px] pt-7">
          <h3 id={headingId} className="text-cardTitle font-medium text-ink">
            {place.name}
          </h3>
          {place.description !== '' && (
            <p className="flex-1 text-bodySm font-light text-body">{place.description}</p>
          )}
          {place.durationLabel !== '' && (
            <p className="mt-2 border-t border-line pt-4 text-label font-black uppercase text-accent-text">
              {place.durationLabel}
            </p>
          )}
        </div>
      </Link>
    </article>
  );
}
