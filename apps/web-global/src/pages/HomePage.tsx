import { type Lang, type MediaRef } from '@charva/contracts';
import {
  buttonClass,
  Carousel,
  carouselLabels,
  Container,
  Eyebrow,
  Heading,
  imageSizes,
  ImageSlot,
  MosaicGrid,
  mosaicTileSizes,
  Section,
  SectionHead,
} from '@charva/ui';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

import { homeQuery } from '../api/queries';
import { TourBuilder } from '../builder/TourBuilder';
import { ArticleCard } from '../components/ArticleCard';
import { DeferredLeadForm } from '../components/DeferredLeadForm';
import { HotelCard } from '../components/HotelCard';
import { QueryState } from '../components/QueryState';
import { ReviewCard } from '../components/ReviewCard';
import { TourCard } from '../components/TourCard';
import { VideoPlayer } from '../components/VideoPlayer';
import { HeroSearchBar } from '../home/HeroSearchBar';
import { copyFor, fill } from '../i18n';
import { beyondPhonePreview, cardGridClass } from '../lib/cardGrid';
import { useLang } from '../lib/routeParams';
import { path } from '../lib/routes';
import { useDocumentMeta } from '../lib/useDocumentMeta';

export interface HomePageProps {
  lang: Lang;
}

/**
 * The homepage — ten sections, one request.
 *
 * `GET /global/home` returns all of it together, because nine separate calls on a connection
 * that may be poor is nine chances to arrive half-rendered and nine round trips before the
 * largest image on the page can start loading.
 *
 * Three things here are components rather than copies, and in the handoff all three are copies
 * that have already drifted. The builder below is the same `TourBuilder` that `/builder`
 * mounts — the prototype's second copy renders its heading at weight 400 through a duplicated
 * property and offers different options on step two. The tour, hotel and review cards are the
 * same components the catalogue uses; the prototype's homepage versions have no category on a
 * tour, one merged `meta` string instead of a duration and a view count on a video, and a
 * literal `★★★★★` on every review regardless of what was left.
 */
export function HomePage({ lang }: HomePageProps) {
  const copy = copyFor(lang);
  const query = useQuery(homeQuery(lang));
  const data = query.data;

  useDocumentMeta({ route: 'home', pathAfterLang: '' }, lang);

  /*
   * The hero, from the hero slides.
   *
   * It used to be built from the first four rows of `places_to_see`, with the caption taken from
   * the place's name and the photograph from the place's cover *or* a `g-hero-N` slot, whichever
   * was filled. The argument was that Дарваза, Йангыкала, Ашхабад and Мерв already exist as rows
   * and should not be entered twice — but it made the caption of a slide a property of another
   * page, the order of the slides the order of that page, and the photograph a thing with two
   * possible homes. The owner found all three from the outside. `hero_slides` is one row per
   * slide, and the brief on it is what `ImageSlot` draws until the photograph exists (D-21).
   */
  const heroSlides = (data?.slides ?? []).map((slide, index) => {
    const media: MediaRef | null = slide.media;

    return {
      id: String(slide.id),
      label: slide.title,
      content: (
        <div className="relative size-full">
          <ImageSlot
            slotKey={`hero-${String(slide.id)}`}
            brief={slide.brief === '' ? slide.title : slide.brief}
            media={
              media === null
                ? null
                : {
                    src: media.url,
                    alt: media.alt,
                    ...(media.lqip === null ? {} : { lqip: media.lqip }),
                  }
            }
            sizes={imageSizes.full}
            // Only the first slide is the LCP candidate; the other three are behind it.
            priority={index === 0}
            className="size-full"
          />
          {/* The design's gradient, and the reason white text over an unknown photograph is
              legible at all. `pointer-events-none` so it never swallows a click. */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-scrim-hero" />
        </div>
      ),
    };
  });

  return (
    <>
      <QueryState
        lang={lang}
        isPending={query.isPending}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        skeletonCount={1}
        skeletonClassName="h-dvh rounded-none"
      >
        {/*
          The hero fills the window, rather than the 720px the mockup draws.

          720 is what a canvas fixed at 1280×720 can express, not a decision: on any screen
          taller than that the photograph became a letterbox strip with cream below it, and on a
          21:9 monitor it was a fifth of the height. `dvh` rather than `vh` because mobile
          browsers shrink the viewport as their chrome retracts, and `vh` there is the tall
          value — the search bar would start below the fold and rise into it as the user
          scrolled. Umrah's hero has been `min-h-dvh` since it was written; this is the one that
          was left behind.
        */}
        <section className="relative min-h-dvh">
          {/*
            Positioned by a wrapper, not by a class on the carousel.

            `cn` is clsx: `className="absolute inset-0"` on a component that already sets
            `relative` leaves both in the attribute, and Tailwind emits `relative` after
            `absolute`, so the carousel became an in-flow element of zero height. The slides are
            `absolute inset-0` inside it, so they collapsed with it — the hero photograph and
            its scrim shrank to a strip and the light hero text ended up on the cream page.
          */}
          {heroSlides.length > 0 && (
            <div className="absolute inset-0">
              <Carousel
                slides={heroSlides}
                indicators="rail"
                labels={carouselLabels(copy.home)}
                className="size-full"
              />
            </div>
          )}

          <Container className="relative flex min-h-dvh flex-col justify-end pb-20 pt-40 tab:pb-14">
            <div data-surface="dark">
              <Eyebrow>{copy.home.heroEyebrow}</Eyebrow>
              {/*
                Below 1280 the headline stops before the slide rail, rather than running under it.

                The rail is an overlay pinned to the right edge and centred vertically: a label,
                a gap and the bar — about 150px wide — plus its offset from the edge. At 1280 and
                up nothing touches it, because the container is 1160 wide and the headline stops
                at 900. Narrower, the container shrinks but the headline's 900 does not, so it
                runs the full width and the two meet: at 1024 the container is 904 and the rail
                reaches 130px into it. On a 1024×768 screen — an iPad in landscape, a window
                snapped to half a 1080p monitor — the headline is bottom-aligned and tall enough
                to reach the rail's vertical middle, so «ЙАНГЫКАЛА» sat across the second line.

                200 and not 150: the label is the longest slide title, which is content, and the
                fifty pixels of air are what keep this from having to be recalculated the first
                time somebody adds a slide called «Куняургенч».
              */}
              <Heading
                level={1}
                size="hero"
                className="mt-5 max-w-[900px] lap:max-w-[calc(100%_-_200px)] mob:max-w-none"
              >
                {copy.home.heroTitle}
              </Heading>
              <p className="mt-6 max-w-[560px] text-lead font-light text-body">
                {copy.home.heroLead}
              </p>
              <HeroSearchBar lang={lang} className="mt-11 max-w-[1000px]" />
            </div>
          </Container>
        </section>
      </QueryState>

      {/* ---- Популярные туры ------------------------------------------------------------ */}
      <Section space="md" id="tours">
        <Container>
          <SectionHead
            eyebrow={copy.home.tours.eyebrow}
            title={copy.home.tours.title}
            action={
              <Link to={path.tours(lang)} className={buttonClass({ variant: 'outline' })}>
                {/* The count is counted. «32 маршрута» is a literal in the handoff standing
                    above nine rows — decision D-6, question Q-5. */}
                {copy.home.tours.all} · {String(data?.stats.tours ?? 0)}
              </Link>
            }
          />
          <ul className={`mt-10 ${cardGridClass((data?.featuredTours ?? []).length)}`}>
            {(data?.featuredTours ?? []).map((tour, index) => (
              // Three on a phone, six on anything wider: two rows of three become six
              // full-width cards below 768, and «Все туры» is directly above them.
              <li key={tour.id} className={beyondPhonePreview(index, 3)}>
                {/*
                  No priority here, unlike `/tours`, and the difference is the hero above.

                  `priority` means eager *and* `fetchpriority="high"`, which is right for a
                  picture at the top of a page. This section is below a `min-h-dvh` photograph:
                  three card images were being fetched at high priority while the one element
                  LCP is actually measured against was still arriving, on a connection where
                  they share a few hundred kilobits. On the catalogue the first row is the top
                  of the page and there is nothing to take bandwidth from, so it keeps its
                  priority; here they wait their turn like everything else below the fold.
                */}
                <TourCard tour={tour} lang={lang} />
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* ---- Сборщик ------------------------------------------------------------------- */}
      <Section tone="dark" space="md" id="builder">
        <Container>
          <SectionHead
            eyebrow={copy.home.builder.eyebrow}
            title={copy.home.builder.title}
            lead={copy.home.builder.lead}
            className="mb-12"
          />
          {/*
            The same machine as `/builder`, writing its state into this page's URL.

            Not a copy: `basePath` is the only difference between the two mountings, which is
            why the two cannot drift apart the way the prototype's two have.
          */}
          <TourBuilder
            lang={lang}
            basePath={path.home(lang)}
            renderForm={({ selection }) => (
              <DeferredLeadForm
                lang={lang}
                kind="builder"
                selection={selection}
                showGuests={false}
                showTopics={false}
              />
            )}
          />
        </Container>
      </Section>

      {/* ---- Отели --------------------------------------------------------------------- */}
      <Section space="md" id="hotels">
        <Container>
          <SectionHead
            eyebrow={copy.home.hotels.eyebrow}
            title={copy.home.hotels.title}
            action={
              <Link to={path.hotels(lang)} className={buttonClass({ variant: 'outline' })}>
                {copy.home.hotels.all} · {String(data?.stats.hotels ?? 0)}
              </Link>
            }
          />
          <ul className="mt-10 grid list-none grid-cols-4 gap-[22px] p-0 lap:grid-cols-2 mob:grid-cols-1">
            {(data?.hotels ?? []).map((hotel, index) => (
              // Two on a phone: the row of four is already two rows at `lap:`, and one column
              // of four is most of a screen each.
              <li key={hotel.id} className={beyondPhonePreview(index, 2)}>
                <HotelCard hotel={hotel} lang={lang} sizes={imageSizes.cardGrid4} />
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* ---- Журнал -------------------------------------------------------------------- */}
      {(data?.articles.length ?? 0) > 0 && (
        <Section space="md" id="journal">
          <Container>
            <SectionHead
              eyebrow={copy.home.journal.eyebrow}
              title={copy.home.journal.title}
              action={
                <Link to={path.articles(lang)} className={buttonClass({ variant: 'outline' })}>
                  {copy.article.backToList}
                </Link>
              }
            />

            <div className="mt-10 grid grid-cols-[1.35fr_1fr] gap-[26px] tab:grid-cols-1">
              {/* The same card `/articles` is built from — it was written out twice the day the
                  journal got a page, and the second copy is the one that drifts. */}
              {(data?.articles ?? []).slice(0, 1).map((lead) => (
                <ArticleCard key={lead.id} article={lead} lang={lang} size="lead" />
              ))}

              <div className="grid grid-rows-2 gap-[26px]">
                {(data?.articles ?? []).slice(1, 3).map((article) => (
                  <Link
                    key={article.id}
                    to={path.article(lang, article.slug)}
                    className="flex flex-col justify-between gap-4 rounded-card border border-line bg-surface p-8 no-underline transition-colors duration-colour hover:border-line-strong"
                  >
                    <div className="flex flex-col gap-3">
                      {article.tag !== '' && <Eyebrow>{article.tag}</Eyebrow>}
                      <h3 className="text-cardTitle font-medium text-ink">{article.title}</h3>
                      {article.summary !== '' && (
                        <p className="text-bodySm font-light text-body">{article.summary}</p>
                      )}
                    </div>
                    {article.readMinutes !== null && (
                      <p className="text-bodySm text-muted">
                        {fill(copy.common.readMinutes, { count: article.readMinutes })}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </Container>
        </Section>
      )}

      {/* ---- Мозаика ------------------------------------------------------------------- */}
      {(data?.gallery.length ?? 0) > 0 && (
        <Section space="md" id="gallery">
          <Container>
            <SectionHead
              eyebrow={copy.home.gallery.eyebrow}
              title={copy.home.gallery.title}
              action={
                <Link to={path.gallery(lang)} className={buttonClass({ variant: 'outline' })}>
                  {copy.home.gallery.all}
                </Link>
              }
              className="mb-10"
            />
            {/*
              Packed rather than placed.

              The spans are an editor's request; `packMosaic` inside `MosaicGrid` narrows
              anything that will not fit into the row it lands in (D-16). The prototype writes
              eight `<div>`s straight into the markup with fixed grid coordinates, which is why
              its gallery page leaves holes the moment anything is filtered.
            */}
            <MosaicGrid
              items={(data?.gallery ?? []).map((item, index) => ({
                id: String(item.id),
                spanCols: item.spanCols,
                spanRows: item.spanRows,
                // Four on a phone, where the mosaic is a single column and each tile is a
                // banner: eight of them is four screens of photographs on the way to the
                // enquiry form, and «вся галерея» is the button directly above.
                className: beyondPhonePreview(index, 4),
                content: (
                  <Link
                    to={path.gallery(lang)}
                    className="group relative block size-full overflow-hidden no-underline"
                  >
                    <ImageSlot
                      slotKey={`gallery-${String(item.id)}`}
                      brief={item.caption}
                      media={
                        item.media === null ? null : { src: item.media.url, alt: item.media.alt }
                      }
                      sizes={mosaicTileSizes(item.spanCols)}
                      className="size-full"
                    />
                    {item.caption !== '' && (
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-scrim-strong to-transparent p-4 text-bodySm font-semibold text-dark-on">
                        {item.caption}
                      </span>
                    )}
                  </Link>
                ),
              }))}
            />
          </Container>
        </Section>
      )}

      {/* ---- Видео --------------------------------------------------------------------- */}
      {(data?.videos.length ?? 0) > 0 && (
        <Section tone="dark" space="md" id="video">
          <Container>
            <SectionHead
              eyebrow={copy.home.video.eyebrow}
              title={copy.home.video.title}
              action={
                <Link to={path.video(lang)} className={buttonClass({ variant: 'outline' })}>
                  {copy.home.video.all}
                </Link>
              }
              className="mb-10"
            />

            <div className="grid grid-cols-[1.6fr_1fr] gap-[26px] tab:grid-cols-1">
              {(data?.videos ?? []).slice(0, 1).map((featured) => (
                <div key={featured.id}>
                  <VideoPlayer
                    video={featured}
                    lang={lang}
                    className="aspect-video w-full overflow-hidden rounded-panel"
                  />
                  <h3 className="mt-5 text-h3 font-medium text-ink">{featured.title}</h3>
                </div>
              ))}

              <ul className="flex list-none flex-col gap-[18px] p-0">
                {(data?.videos ?? []).slice(1, 4).map((video) => (
                  <li key={video.id} className="flex gap-4">
                    <VideoPlayer
                      video={video}
                      lang={lang}
                      className="aspect-video w-[150px] shrink-0 overflow-hidden rounded-media"
                    />
                    <div>
                      <h3 className="text-body font-medium text-ink">{video.title}</h3>
                      {video.description !== '' && (
                        <p className="mt-1 text-bodySm font-light text-muted">
                          {video.description}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Container>
        </Section>
      )}

      {/* ---- Факты и виза -------------------------------------------------------------- */}
      <Section space="md">
        <Container>
          <div className="grid grid-cols-2 gap-20 tab:grid-cols-1 tab:gap-12">
            <div>
              <Heading level={2} size="h2Sm">
                {copy.country.factsTitle}
              </Heading>
              {/*
                Seven of the country page's eight — one boolean on the row, not a second table.

                The API sends only the featured ones here, so the difference between the two
                lists is a flag an editor can see rather than two sets of facts that will
                eventually disagree (D-17).
              */}
              <dl className="mt-8">
                {(data?.facts ?? []).map((fact) => (
                  <div
                    key={fact.id}
                    className="grid grid-cols-fact gap-5 border-b border-line py-[17px] mob:grid-cols-1 mob:gap-1"
                  >
                    <dt className="text-bodySm text-muted">{fact.key}</dt>
                    <dd className="text-body text-ink">{fact.value}</dd>
                  </div>
                ))}
              </dl>
              <Link
                to={path.country(lang)}
                className={buttonClass({ variant: 'ghost', className: 'mt-6' })}
              >
                {copy.home.country.more}
              </Link>
            </div>

            <div className="h-fit rounded-block border border-line bg-surface p-11 mob:p-6">
              <Heading level={2} size="h2Sm">
                {copy.country.visaTitle}
              </Heading>
              <ol className="mt-8 flex list-none flex-col gap-6 p-0">
                {(data?.visaSteps ?? []).map((step, index) => (
                  <li key={step.id} className="flex gap-4">
                    <span aria-hidden="true" className="text-label font-black text-accent-text">
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
        </Container>
      </Section>

      {/* ---- Отзывы -------------------------------------------------------------------- */}
      {(data?.reviews.length ?? 0) > 0 && (
        <Section space="md" id="reviews">
          <Container>
            <SectionHead
              eyebrow={copy.home.reviews.eyebrow}
              title={copy.home.reviews.title}
              action={
                <Link to={path.reviews(lang)} className={buttonClass({ variant: 'outline' })}>
                  {copy.home.reviews.all} · {String(data?.reviewSummary.total ?? 0)}
                </Link>
              }
            />
            <ul className="mt-10 grid list-none grid-cols-3 gap-6 p-0 lap:grid-cols-2 mob:grid-cols-1">
              {(data?.reviews ?? []).slice(0, 3).map((review) => (
                <li key={review.id}>
                  <ReviewCard review={review} lang={lang} />
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      )}

      {/* ---- Заявка -------------------------------------------------------------------- */}
      <Section space="md" className="pb-section-lg" id="contact">
        <Container>
          <div
            data-surface="dark"
            className="grid grid-cols-[1.1fr_1fr] gap-16 rounded-block bg-dark-alt p-13 tab:grid-cols-1 tab:gap-10 mob:p-8"
          >
            <div>
              <Heading level={2} size="h2">
                {copy.home.contact.title}
              </Heading>
              <p className="mt-5 max-w-[460px] text-lead font-light text-body">
                {copy.home.contact.lead}
              </p>
            </div>
            <DeferredLeadForm lang={lang} kind="tour" showTopics={false} />
          </div>
        </Container>
      </Section>
    </>
  );
}

/**
 * What the router mounts, and the reason it lives here rather than beside the route.
 *
 * A named function and not an inline arrow: the hooks below sit in a function React lint
 * rules would not recognise as a component if it were anonymous, and the same anonymity is
 * what would let a hook end up behind a condition without anything noticing.
 *
 * It is in this file because the route is lazy, and the chunk boundary is this module: the
 * router imports only the name, so nothing below is downloaded until the page is asked for.
 */
export function HomeRoute() {
  return <HomePage lang={useLang()} />;
}
