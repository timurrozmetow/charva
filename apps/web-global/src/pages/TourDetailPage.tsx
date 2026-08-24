import { formatMoney, type Lang } from '@charva/contracts';
import {
  Badge,
  buttonClass,
  cn,
  Container,
  Eyebrow,
  Heading,
  Icon,
  imageSizes,
  ImageSlot,
  Section,
  StarRating,
} from '@charva/ui';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type ReactNode } from 'react';

import { tourQuery } from '../api/queries';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { LeadForm } from '../components/LeadForm';
import { Prose } from '../components/Prose';
import { QueryState } from '../components/QueryState';
import { TourCard } from '../components/TourCard';
import { copyFor, fill, plural } from '../i18n';
import { isNotFound } from '../lib/isNotFound';
import { path } from '../lib/routes';
import { useDocumentMeta } from '../lib/useDocumentMeta';

import { NotFoundPage } from './NotFoundPage';

export interface TourDetailPageProps {
  lang: Lang;
  slug: string;
}

/**
 * One tour.
 *
 * There is no design for this page. Every card in the handoff links to `#`, on all three sites,
 * so nothing was ever drawn behind them — this is designed in the same tokens as the pages that
 * were, which is why it reads as a longer version of the catalogue card rather than as a new
 * kind of page.
 *
 * For a long time it deliberately did **not** show what the price includes: no row anywhere held
 * one, and a list of what a tour operator provides for $1,290 is a commercial commitment that
 * nobody here was entitled to invent. Question Q-20 asked the owner for it and the answer arrived
 * as a tour sheet, so the page now prints the sheet — the two lists and the price per party size.
 *
 * A tour without them prints neither, and neither does it apologise for it. Eight of the nine
 * demo rows have no composition, and a heading over an empty column reads as a page that failed
 * to load rather than as a tour whose sheet has not been typed in yet.
 */
export function TourDetailPage({ lang, slug }: TourDetailPageProps) {
  const copy = copyFor(lang);
  const query = useQuery(tourQuery(lang, slug));
  const tour = query.data;
  const categories: Record<string, string> = copy.categories;

  useDocumentMeta(
    {
      route: 'tours',
      pathAfterLang: `/tours/${slug}`,
      ...(tour === undefined ? {} : { content: { name: tour.title, summary: tour.summary } }),
    },
    lang,
  );

  // A slug that no longer exists is a wrong address, not a failure to load.
  if (isNotFound(query.error)) return <NotFoundPage lang={lang} />;

  return (
    <>
      <Breadcrumbs
        lang={lang}
        trail={[
          { label: copy.tour.breadcrumb, href: path.tours(lang) },
          { label: tour?.title ?? '…' },
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
            skeletonClassName="h-[560px] rounded-panel"
          >
            {tour !== undefined && (
              <>
                <Eyebrow>{categories[tour.category] ?? tour.category}</Eyebrow>
                <Heading level={1} size="h1" className="mt-4 max-w-[900px]">
                  {tour.title}
                </Heading>
                {tour.summary !== '' && (
                  <p className="mt-6 max-w-[620px] text-lead font-light text-body">
                    {tour.summary}
                  </p>
                )}

                <div className="relative mt-11">
                  <ImageSlot
                    slotKey={`tour-cover-${tour.slug}`}
                    brief={tour.title}
                    media={
                      tour.cover === null
                        ? null
                        : {
                            src: tour.cover.url,
                            alt: tour.cover.alt,
                            ...(tour.cover.lqip === null ? {} : { lqip: tour.cover.lqip }),
                            ...(tour.cover.width === null ? {} : { width: tour.cover.width }),
                            ...(tour.cover.height === null ? {} : { height: tour.cover.height }),
                          }
                    }
                    sizes={imageSizes.rail}
                    ratio="16/9"
                    // The largest element on the page, and the reason it is not lazy.
                    priority
                    className="h-[520px] w-full rounded-panel lap:h-[380px] mob:h-[240px]"
                  />
                  {tour.tag !== '' && (
                    <Badge variant="tint" className="absolute left-6 top-6">
                      {tour.tag}
                    </Badge>
                  )}
                </div>

                <div className="mt-12 grid grid-cols-[1fr_360px] items-start gap-16 lap:gap-10 tab:grid-cols-1">
                  <div>
                    {tour.body !== '' && (
                      <>
                        <Heading level={2} size="h2Sm">
                          {copy.tour.aboutTitle}
                        </Heading>
                        <Prose text={tour.body} className="mt-6" />
                      </>
                    )}

                    {tour.itinerary.length > 0 && (
                      <>
                        <Heading level={2} size="h2Sm" className="mt-16">
                          {copy.tour.programTitle}
                        </Heading>
                        <ol className="mt-8 flex list-none flex-col gap-0 p-0">
                          {tour.itinerary.map((day) => (
                            <li
                              key={day.dayNumber}
                              className="grid grid-cols-[130px_1fr] gap-6 border-t border-line py-7 mob:grid-cols-1 mob:gap-2"
                            >
                              <div>
                                <p className="text-label font-black uppercase text-accent-text">
                                  {fill(copy.tour.dayLabel, { n: day.dayNumber })}
                                </p>
                                {day.city !== '' && (
                                  <p className="mt-1 text-bodySm text-muted">{day.city}</p>
                                )}
                              </div>
                              <div>
                                <h3 className="text-cardTitle font-medium text-ink">{day.title}</h3>
                                {day.description !== '' && <DayLines text={day.description} />}
                              </div>
                            </li>
                          ))}
                        </ol>
                      </>
                    )}
                  </div>

                  {/*
                    Sticky on a long itinerary, static once the layout stacks.

                    A panel that follows the scroll is useful beside fourteen days of programme
                    and actively harmful on a phone, where it would occupy a third of the screen
                    for the whole page.
                  */}
                  <aside className="sticky top-28 rounded-block border border-line bg-surface p-8 tab:static mob:p-6">
                    <p className="text-label font-bold uppercase text-muted">
                      {copy.tour.priceLabel}
                    </p>
                    <p className="mt-2 text-h2Sm font-medium text-ink">
                      {copy.common.from} {formatMoney(tour.priceFrom)}
                    </p>
                    {/* The hedge gives way to the table. «Итог зависит от числа гостей» is what
                        a page says when it cannot say what the number is; once the tiers exist,
                        saying it as well would be an apology for an answer already on screen. */}
                    <p className="mt-2 text-bodySm font-light text-muted">
                      {tour.prices.length > 0 ? copy.tour.pricesNote : copy.tour.priceNote}
                    </p>

                    {tour.prices.length > 0 && (
                      <ul className="mt-6 flex list-none flex-col gap-0 p-0">
                        {tour.prices.map((tier) => (
                          <li
                            key={tier.pax}
                            className="flex items-baseline justify-between gap-4 border-b border-line py-3"
                          >
                            <span className="text-bodySm text-muted">
                              {plural(copy.common.people, tier.pax, lang)}
                            </span>
                            <span className="text-body font-medium text-ink">
                              {formatMoney(tier.price)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <dl className="mt-7">
                      <Fact label={copy.tour.facts.days}>
                        {plural(copy.common.days, tour.days, lang)}
                      </Fact>
                      <Fact label={copy.tour.facts.cities}>{String(tour.cities)}</Fact>
                      {tour.hotelStars !== null && (
                        <Fact label={copy.tour.facts.hotels}>
                          <StarRating
                            value={tour.hotelStars}
                            label={fill(copy.common.stars, { count: tour.hotelStars })}
                          />
                        </Fact>
                      )}
                      <Fact label={copy.tour.facts.category}>
                        {categories[tour.category] ?? tour.category}
                      </Fact>
                    </dl>

                    <a
                      href="#enquiry"
                      className={buttonClass({ fullWidth: true, className: 'mt-8' })}
                    >
                      {copy.tour.formTitle}
                    </a>
                    <Link
                      to={path.builder(lang)}
                      className={buttonClass({
                        variant: 'outline',
                        fullWidth: true,
                        className: 'mt-3',
                      })}
                    >
                      {copy.tour.builderCta}
                    </Link>
                  </aside>
                </div>
              </>
            )}
          </QueryState>
        </Container>
      </Section>

      {/*
        The two lists a tour sheet prints side by side, and this page could not print at all: it
        showed one figure and said the manager confirms the rest.

        Full width rather than in the column beside the price panel, for the reason the sheet
        does it that way — «Что входит в стоимость» does not fit on one line in 370 pixels, and a
        heading that wraps while the one next to it does not leaves the two lists starting at
        different heights. A tick against a cross rather than two shades of the same tick:
        «included» against «not included» is the one distinction here a reader must not have to
        infer from a colour.
      */}
      {tour !== undefined && (tour.included.length > 0 || tour.excluded.length > 0) && (
        <Section space="md">
          <Container>
            <div className="grid grid-cols-2 gap-x-16 gap-y-14 tab:grid-cols-1">
              <Checklist
                title={copy.tour.includedTitle}
                items={tour.included}
                icon="check"
                tone="accent"
              />
              <Checklist
                title={copy.tour.excludedTitle}
                items={tour.excluded}
                icon="cross"
                tone="muted"
              />
            </div>
          </Container>
        </Section>
      )}

      {tour !== undefined && tour.gallery.length > 0 && (
        <Section space="md">
          <Container>
            <Heading level={2} size="h2Sm">
              {copy.tour.galleryTitle}
            </Heading>
            <ul className="mt-8 grid list-none grid-cols-3 gap-6 p-0 lap:grid-cols-2 mob:grid-cols-1">
              {tour.gallery.map((shot) => (
                <li key={shot.media.url}>
                  <ImageSlot
                    slotKey={`tour-gallery-${tour.slug}`}
                    brief={shot.caption}
                    media={{ src: shot.media.url, alt: shot.media.alt }}
                    sizes={imageSizes.cardGrid}
                    ratio="4/3"
                    className="h-[240px] w-full rounded-media"
                  />
                  {shot.caption !== '' && (
                    <p className="mt-3 text-bodySm text-muted">{shot.caption}</p>
                  )}
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      )}

      {/* The gap above the band is `Section`'s own doing now, not this page's. */}
      <Section tone="dark" space="md" id="enquiry">
        <Container>
          <div className="grid grid-cols-[1fr_1.1fr] items-start gap-16 tab:grid-cols-1 tab:gap-10">
            <div>
              <Heading level={2} size="h2">
                {copy.tour.formTitle}
              </Heading>
              <p className="mt-5 max-w-[460px] text-lead font-light text-body">
                {copy.tour.formLead}
              </p>
            </div>
            {/* `contextTitle` is why the manager knows which page this came from — and it is
                rendered above the fields as well, so nothing is attached out of sight. */}
            <LeadForm
              lang={lang}
              kind="tour"
              {...(tour === undefined ? {} : { contextTitle: tour.title })}
              className="rounded-panel border border-line bg-surface p-11 mob:p-6"
            />
          </div>
        </Container>
      </Section>

      {tour !== undefined && tour.related.length > 0 && (
        <Section space="md" className="pb-section">
          <Container>
            <Heading level={2} size="h2Sm">
              {copy.tour.relatedTitle}
            </Heading>
            <ul className="mt-8 grid list-none grid-cols-3 gap-6 p-0 lap:grid-cols-2 mob:grid-cols-1">
              {tour.related.map((related) => (
                <li key={related.id}>
                  <TourCard tour={related} lang={lang} />
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      )}
    </>
  );
}

/**
 * A day's programme, which is a list far more often than it is a paragraph.
 *
 * The seeded days are one sentence each and the first real tour's are five bullets each, so the
 * shape follows the text rather than the other way round: run them together into a paragraph and
 * «Обед.» ends up in the middle of a sentence about a canyon.
 */
function DayLines({ text }: { text: string }) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

  if (lines.length < 2) {
    return <p className="mt-2 text-bodySm font-light text-body">{text}</p>;
  }

  return (
    <ul className="mt-3 flex list-none flex-col gap-2 p-0">
      {lines.map((line, index) => (
        <li key={`${String(index)}-${line.slice(0, 24)}`} className="flex items-start gap-3">
          <span aria-hidden className="mt-[9px] size-[5px] shrink-0 rounded-full bg-accent" />
          <span className="text-bodySm font-light text-body">{line}</span>
        </li>
      ))}
    </ul>
  );
}

/** «Что входит в стоимость» and its opposite — the same list twice, marked differently. */
function Checklist({
  title,
  items,
  icon,
  tone,
}: {
  title: string;
  items: string[];
  icon: 'check' | 'cross';
  tone: 'accent' | 'muted';
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <Heading level={2} size="h2Sm">
        {title}
      </Heading>
      {/*
        Loose on purpose. Several of these lines wrap to two and three — the visa paragraph is
        four — and at a three-unit gap a wrapped item ran into the next one, so the column read
        as prose rather than as a list somebody can count.
      */}
      <ul className="mt-8 flex list-none flex-col gap-5 p-0">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-4">
            <Icon
              name={icon}
              size={16}
              className={cn('mt-1 shrink-0', tone === 'accent' ? 'text-accent' : 'text-muted')}
            />
            <span className="text-bodySm font-light text-body">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One row of the price panel's definition list. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-3">
      <dt className="text-bodySm text-muted">{label}</dt>
      <dd className="text-bodySm font-medium text-ink">{children}</dd>
    </div>
  );
}
