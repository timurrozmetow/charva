import { type ContentSlot, type Lang, type MediaRef } from '@charva/contracts';
import {
  Accordion,
  buttonClass,
  Carousel,
  Container,
  Eyebrow,
  Heading,
  imageSizes,
  ImageSlot,
  Section,
  SectionHead,
  StatStrip,
} from '@charva/ui';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

import { homeQuery } from '../api/queries';
import { QueryState } from '../components/QueryState';
import { TripPanel } from '../components/TripPanel';
import { ZiyaratCard } from '../components/ZiyaratCard';
import { copyFor, fill } from '../i18n';
import { formatDate } from '../lib/formatDate';
import { path } from '../lib/routes';
import { useDocumentMeta } from '../lib/useDocumentMeta';

export interface HomePageProps {
  lang: Lang;
}

/**
 * The Umrah homepage.
 *
 * Everything dated, counted or measured on this page comes from one row of `umrah_trips`
 * through one request. The prototype has the same departure hardcoded as a `TARGET` constant,
 * typed as `18.09.2026` in four more places in the same file, and its seat count, its progress
 * bar and its «Boş ýer» line are three independent literals that already disagree.
 *
 * The hero's overlay is the one thing genuinely different from Global's — 105° rather than
 * vertical — and it is one token rather than a second hand-written gradient.
 */
export function HomePage({ lang }: HomePageProps) {
  const copy = copyFor(lang);
  const query = useQuery(homeQuery(lang));
  const data = query.data;

  useDocumentMeta({ route: 'home', pathAfterLang: '' }, lang);

  const slotFor = (key: string): ContentSlot | undefined =>
    data?.slots.find((slot) => slot.slotKey === key);

  /*
   * The hero, from the hero slides.
   *
   * It used to be the first three rows of `ziyarat_places`, on the same argument Global's hero
   * used — and here that argument had already failed on its own terms. The design's three slides
   * are Mekge, Medine and **Topar**, a group in ihram; «Topar» is not a ziyarat place and cannot
   * be one, so the third place in the list stood in for it and nobody noticed. One row per slide,
   * and the third slide is now the photograph it was always meant to be.
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
            priority={index === 0}
            className="size-full"
          />
          {/* 105°, not vertical — the one real difference between the two heroes. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-scrim-hero-diagonal"
          />
        </div>
      ),
    };
  });

  const departOn = formatDate(data?.trip?.departAt);

  return (
    <>
      <QueryState
        lang={lang}
        isPending={query.isPending}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        skeletonCount={1}
        // The same height as the hero it stands in for — 80vh against a `min-h-dvh` hero was a
        // fifth of the window jumping into place the moment the photograph arrived.
        skeletonClassName="h-dvh rounded-none"
      >
        <section className="relative min-h-dvh">
          {/*
            Positioned by a wrapper, not by a class on the carousel — see the same note on
            Global's hero. `cn` is clsx, so `absolute` passed to a component that already sets
            `relative` does not replace it: both stay, and Tailwind's order picks `relative`.
          */}
          {heroSlides.length > 0 && (
            <div className="absolute inset-0">
              <Carousel
                slides={heroSlides}
                indicators="dots"
                labels={{
                  region: copy.home.sliderLabel,
                  slide: (index, total) => fill(copy.home.slide, { index: index + 1, total }),
                  goTo: (index, label) =>
                    `${fill(copy.home.goToSlide, { index: index + 1 })}${
                      label === undefined ? '' : `, ${label}`
                    }`,
                  pause: copy.home.pause,
                  play: copy.home.play,
                }}
                className="size-full"
                indicatorsClassName="bottom-10 left-gutter mob:left-6"
              />
            </div>
          )}

          <Container className="relative grid min-h-dvh grid-cols-[1.05fr_0.95fr] items-center gap-[60px] py-32 tab:grid-cols-1 tab:gap-10 tab:py-24">
            <div data-surface="dark">
              {departOn !== null && (
                <p className="inline-flex items-center gap-2 rounded-full border border-tint-line bg-tint-soft px-[18px] py-[9px] text-label font-black uppercase text-accent-text">
                  {/* The pulse is the design's; under `prefers-reduced-motion` the global rule
                      in styles.css stops it, which is why it is a class and not an inline
                      animation. */}
                  <span
                    aria-hidden="true"
                    className="size-[7px] animate-pulse rounded-full bg-accent"
                  />
                  {fill(copy.trip.badgeNext, { date: departOn })}
                </p>
              )}

              <Heading level={1} size="hero" className="mt-6 max-w-[640px]">
                {copy.home.heroTitle}
              </Heading>
              <p className="mt-6 max-w-[520px] text-lead font-light text-body">
                {copy.home.heroLead}
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <Link to={path.yazylmak(lang)} className={buttonClass({ size: 'lg' })}>
                  {copy.home.ctaPrimary}
                </Link>
                <Link
                  to={path.paket(lang)}
                  className={buttonClass({ variant: 'outline', size: 'lg' })}
                >
                  {copy.home.ctaSecondary}
                </Link>
              </div>
            </div>

            <TripPanel trip={data?.trip ?? null} next={data?.next ?? null} lang={lang} />
          </Container>
        </section>
      </QueryState>

      {/* ---- Statistika ---------------------------------------------------------------- */}
      <Section tone="dark" space="none" className="py-[34px]">
        <Container>
          {/*
            Counted, every one of them.

            «68 Ugradylan topar» and «2 840 Zyýaratçy» are literals in the handoff, sitting above
            six rows of archive — decision D-6, question Q-5.
          */}
          <StatStrip
            items={[
              { value: String(data?.stats.groups ?? 0), label: copy.home.stats.groups },
              { value: String(data?.stats.pilgrims ?? 0), label: copy.home.stats.pilgrims },
              { value: String(data?.stats.places ?? 0), label: copy.home.stats.places },
              { value: String(data?.stats.programDays ?? 0), label: copy.home.stats.programDays },
            ]}
            // The one strip the handoff draws at 40 rather than 22: it spans the full container
            // here, so its four columns are 310px wide and the default would crowd them.
            gap="wide"
          />
        </Container>
      </Section>

      {/* ---- Paket --------------------------------------------------------------------- */}
      <Section space="md">
        <Container>
          <div className="grid grid-cols-[1fr_1.05fr] items-stretch gap-[26px] tab:grid-cols-1">
            <div
              data-surface="dark"
              className="rounded-panel border border-accent bg-dark-alt p-11 mob:p-6"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <Eyebrow>{copy.home.package.eyebrow}</Eyebrow>
                {data?.trip !== null && data?.trip !== undefined && (
                  <span className="text-bodySm text-muted">
                    {fill(copy.common.days.other, { count: data.trip.durationDays })}
                  </span>
                )}
              </div>

              <Heading level={2} size="h2Sm" className="mt-5">
                {copy.home.package.title}
              </Heading>

              {/* Two columns of small marked items, as the design draws — the same
                  `content_blocks` rows the package page lists in full (D-17). */}
              <ul className="mt-8 grid list-none grid-cols-2 gap-x-8 gap-y-3 p-0 mob:grid-cols-1">
                {(data?.packageItems ?? []).map((item) => (
                  <li key={item.id} className="flex gap-3 text-bodySm font-light text-body">
                    <span aria-hidden="true" className="text-accent-text">
                      ✦
                    </span>
                    {item.key === '' ? item.value : item.key}
                  </li>
                ))}
              </ul>

              <div className="mt-9 flex flex-wrap gap-3">
                <Link to={path.yazylmak(lang)} className={buttonClass()}>
                  {copy.home.package.cta}
                </Link>
                <Link to={path.paket(lang)} className={buttonClass({ variant: 'outline' })}>
                  {copy.home.package.more}
                </Link>
              </div>
            </div>

            <ImageSlot
              slotKey="u-pack-cover"
              brief={slotFor('u-pack-cover')?.brief ?? copy.home.package.title}
              media={
                slotFor('u-pack-cover')?.media === undefined ||
                slotFor('u-pack-cover')?.media === null
                  ? null
                  : {
                      src: slotFor('u-pack-cover')?.media?.url ?? '',
                      alt: slotFor('u-pack-cover')?.media?.alt ?? '',
                    }
              }
              sizes={imageSizes.halfPanel}
              ratio="4/3"
              className="min-h-[420px] w-full rounded-panel"
            />
          </div>
        </Container>
      </Section>

      {/* ---- Ziýarat ------------------------------------------------------------------- */}
      {(data?.ziyarat.length ?? 0) > 0 && (
        <Section space="md">
          <Container>
            <SectionHead
              eyebrow={copy.home.ziyarat.eyebrow}
              title={copy.home.ziyarat.title}
              action={
                <Link to={path.ziyarat(lang)} className={buttonClass({ variant: 'outline' })}>
                  {copy.home.ziyarat.all} · {String(data?.stats.places ?? 0)}
                </Link>
              }
            />
            <ul className="mt-10 grid list-none grid-cols-3 gap-6 p-0 lap:grid-cols-2 mob:grid-cols-1">
              {(data?.ziyarat ?? []).slice(0, 3).map((place) => (
                <li key={place.id}>
                  <ZiyaratCard place={place} lang={lang} />
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      )}

      {/* ---- Iki blok: maksatnama we suratlar ------------------------------------------ */}
      <Section space="md">
        <Container>
          <div className="grid grid-cols-[1.15fr_1fr] gap-[26px] tab:grid-cols-1">
            <div
              data-surface="dark"
              className="flex min-h-[340px] flex-col justify-between rounded-panel bg-dark-alt p-11 mob:p-6"
            >
              <div>
                <Eyebrow>{copy.home.program.eyebrow}</Eyebrow>
                <Heading level={2} size="h2Sm" className="mt-4">
                  {copy.home.program.title}
                </Heading>
                <p className="mt-4 max-w-[420px] text-body font-light text-body">
                  {copy.home.program.text}
                </p>
              </div>
              <Link
                to={path.maksatnama(lang)}
                className={buttonClass({ className: 'mt-8 self-start' })}
              >
                {copy.home.program.cta}
              </Link>
            </div>

            <div className="relative min-h-[340px] overflow-hidden rounded-panel">
              <ImageSlot
                slotKey="u-media-preview"
                brief={slotFor('u-media-preview')?.brief ?? copy.home.media.title}
                media={null}
                className="absolute inset-0 size-full"
              />
              <div
                data-surface="dark"
                className="relative flex h-full flex-col justify-end bg-gradient-to-t from-scrim-strong to-transparent p-9 mob:p-6"
              >
                <Eyebrow>{copy.home.media.eyebrow}</Eyebrow>
                <Heading level={2} size="h3" className="mt-3">
                  {copy.home.media.title}
                </Heading>
                <p className="mt-3 text-bodySm font-light text-body">{copy.home.media.text}</p>
                <Link
                  to={path.suratlar(lang)}
                  className={buttonClass({ variant: 'outline', className: 'mt-6 self-start' })}
                >
                  {copy.home.media.cta}
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* ---- Ýazylmak ------------------------------------------------------------------ */}
      <Section space="md">
        <Container>
          <div
            data-surface="dark"
            className="grid grid-cols-[1.1fr_1fr] items-center gap-14 rounded-block bg-dark p-13 tab:grid-cols-1 tab:gap-10 mob:p-8"
          >
            <div>
              <Heading level={2} size="h2">
                {copy.home.signup.title}
              </Heading>
              <p className="mt-5 max-w-[460px] text-lead font-light text-body">
                {copy.home.signup.text}
              </p>
              <Link
                to={path.yazylmak(lang)}
                className={buttonClass({ size: 'lg', className: 'mt-8' })}
              >
                {copy.home.signup.cta}
              </Link>
            </div>
            <ImageSlot
              slotKey="u-signup-cover"
              brief={slotFor('u-signup-cover')?.brief ?? copy.home.signup.title}
              media={null}
              ratio="4/3"
              className="min-h-[320px] w-full rounded-panel"
            />
          </div>
        </Container>
      </Section>

      {/* ---- Soraglar ------------------------------------------------------------------ */}
      {(data?.faq.length ?? 0) > 0 && (
        <Section space="md" className="pb-section-lg">
          <Container>
            <Heading level={2} size="h2">
              {copy.home.faqTitle}
            </Heading>
            <Accordion
              columns={2}
              className="mt-10"
              items={(data?.faq ?? []).map((item) => ({
                id: String(item.id),
                question: item.question,
                answer: item.answer,
              }))}
              defaultOpen={data?.faq[0] === undefined ? [] : [String(data.faq[0].id)]}
            />
          </Container>
        </Section>
      )}
    </>
  );
}
