import { type Lang, type UmrahGroupMedia } from '@charva/contracts';
import {
  buttonClass,
  Container,
  Eyebrow,
  Heading,
  Icon,
  ImageSlot,
  Lightbox,
  LoadMore,
  MosaicGrid,
  Section,
  StatStrip,
  TabPanel,
  Tabs,
} from '@charva/ui';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { type ReactNode, useCallback, useState } from 'react';

import { groupQuery, groupsQuery } from '../api/queries';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { QueryState } from '../components/QueryState';
import { copyFor, fill, plural } from '../i18n';
import { formatDate } from '../lib/formatDate';
import { path } from '../lib/routes';
import { useDocumentMeta } from '../lib/useDocumentMeta';

export interface MediaPageProps {
  lang: Lang;
}

const PER_PAGE = 6;

/**
 * The id the tab list and its panel agree on.
 *
 * They are in two different `<Section>`s — the tabs above, the mosaic below — and nesting one
 * inside the other to share a React context would change the page's width and padding. A fixed
 * prefix lets `aria-controls` on a tab point at the panel that is actually there, which is
 * what makes it a tab list rather than a row of buttons wearing the role.
 */
const TABS_ID = 'suratlar-groups';

/**
 * Photographs and clips from the groups that have already travelled.
 *
 * Four things the prototype cannot do.
 *
 * **One selected group, in the URL.** Two independent controls — the tab row and every archive
 * row — write the same state there, so «which group am I looking at» exists twice. Here it is
 * `?topar=`, which also makes a group a link somebody can send.
 *
 * **The counters are counted.** The archive claims `videos: 4` beside three clips and
 * `photos: 38` beside eight captions; the header promises sixty-eight groups above six rows.
 * All of these are `COUNT(*)` now, so there is nothing for them to drift from.
 *
 * **The mosaic is packed, not placed.** `LAYOUT[i]` in the prototype is an array of eight fixed
 * spans, and a ninth caption crashes the page. `packMosaic` narrows what will not fit (D-16).
 *
 * **Every photograph opens.** The lightbox the design implies is absent, and the tiles are
 * `<a href="#">`.
 */
export function MediaPage({ lang }: MediaPageProps) {
  const copy = copyFor(lang);
  const navigate = useNavigate();
  const search: Record<string, unknown> = useSearch({ strict: false });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);

  const groups = useQuery(groupsQuery(lang, page * PER_PAGE));

  const raw = search['topar'];
  /** The chosen group, or the newest one — never a fifth piece of state. */
  const selected =
    typeof raw === 'string' && raw !== '' ? raw : (groups.data?.items[0]?.slug ?? '');

  const setSelected = useCallback(
    (slug: string) => {
      void navigate({ to: path.suratlar(lang), search: { topar: slug }, replace: true });
      setOpen(null);
    },
    [navigate, lang],
  );

  const group = useQuery({ ...groupQuery(lang, selected), enabled: selected !== '' });

  useDocumentMeta({ route: 'suratlar', pathAfterLang: '/suratlar' }, lang);

  const items = groups.data?.items ?? [];
  const stats = groups.data?.stats;
  const photos = group.data?.photos ?? [];
  const videos = group.data?.videos ?? [];

  /** Only tiles with a photograph can be opened; the rest are still laid out at full size. */
  const openable = photos.filter((photo) => photo.media !== null);

  return (
    <>
      <Breadcrumbs lang={lang} trail={[{ label: copy.suratlar.breadcrumb }]} />

      <Section space="sm">
        <Container>
          <div className="grid grid-cols-[1.3fr_1fr] items-end gap-[70px] tab:grid-cols-1 tab:gap-8">
            <div>
              <Eyebrow>{copy.brand}</Eyebrow>
              <Heading level={1} size="h1" className="mt-4">
                {copy.suratlar.title}
              </Heading>
              <p className="mt-6 max-w-[560px] text-lead font-light text-body">
                {copy.suratlar.lead}
              </p>
            </div>

            {stats !== undefined && (
              <StatStrip
                items={[
                  { value: String(stats.groups), label: copy.suratlar.stats.groups },
                  { value: String(stats.pilgrims), label: copy.suratlar.stats.pilgrims },
                  { value: String(stats.photos), label: copy.suratlar.stats.photos },
                  { value: String(stats.videos), label: copy.suratlar.stats.videos },
                ]}
              />
            )}
          </div>
        </Container>
      </Section>

      <Section space="sm">
        <Container>
          <QueryState
            lang={lang}
            isPending={groups.isPending}
            isError={groups.isError}
            onRetry={() => void groups.refetch()}
            skeletonCount={3}
            skeletonClassName="h-[80px] rounded-panel-sm"
          >
            <Tabs
              items={items.map((item) => ({
                value: item.slug,
                label: (
                  <span className="flex flex-col items-start gap-[5px]">
                    <span className="text-body font-semibold">{item.shortLabel}</span>
                    <span className="text-bodySm font-light">
                      {plural(copy.suratlar.photos, item.photoCount, lang)} ·{' '}
                      {plural(copy.suratlar.videos, item.videoCount, lang)}
                    </span>
                  </span>
                ),
              }))}
              value={selected}
              onValueChange={setSelected}
              label={copy.suratlar.tabsLabel}
              idBase={TABS_ID}
            />
          </QueryState>
        </Container>
      </Section>

      <Section space="sm">
        <Container>
          <TabPanel value={selected} idBase={TABS_ID}>
            <QueryState
              lang={lang}
              isPending={group.isPending && selected !== ''}
              isError={group.isError}
              onRetry={() => void group.refetch()}
              skeletonCount={6}
              skeletonClassName="h-[220px] rounded-media"
            >
              <MosaicGrid
                items={photos.map((photo) => {
                  const openIndex = openable.findIndex((candidate) => candidate.id === photo.id);

                  return {
                    id: String(photo.id),
                    spanCols: photo.spanCols,
                    spanRows: photo.spanRows,
                    content:
                      photo.media === null ? (
                        <ImageSlot
                          slotKey={`u-group-${selected}-${String(photo.id)}`}
                          brief={photo.caption}
                          media={null}
                          className="size-full"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setOpen(openIndex);
                          }}
                          className="group relative block size-full overflow-hidden text-left"
                        >
                          <ImageSlot
                            slotKey={`u-group-${selected}-${String(photo.id)}`}
                            brief={photo.caption}
                            media={{ src: photo.media.url, alt: photo.media.alt }}
                            className="size-full"
                          />
                          {photo.caption !== '' && (
                            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-scrim-strong to-transparent p-4 text-bodySm font-semibold text-dark-on">
                              {photo.caption}
                            </span>
                          )}
                          <span className="sr-only">{copy.suratlar.openPhoto}</span>
                        </button>
                      ),
                  };
                })}
              />

              {videos.length > 0 && (
                <>
                  <Heading level={2} size="h2Sm" className="mt-16">
                    {copy.suratlar.videosTitle}
                  </Heading>
                  <ul className="mt-8 grid list-none grid-cols-3 gap-[22px] p-0 lap:grid-cols-2 mob:grid-cols-1">
                    {videos.map((video) => (
                      <li key={video.id}>
                        <GroupVideo video={video} lang={lang} slug={selected} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </QueryState>
          </TabPanel>
        </Container>
      </Section>

      <Section space="md">
        <Container>
          <Heading level={2} size="h2Sm">
            {copy.suratlar.archiveTitle}
          </Heading>

          {/*
            A table, because it is one — six columns of facts about groups, sortable by eye.

            The prototype's rows are `<div onClick>` writing the same state the tabs above write.
            Here the last cell is a real button that selects the group, and the selected row is
            marked with `aria-current` rather than only by a background colour.
          */}
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="bg-line-soft">
                  <Th>{copy.suratlar.archive.group}</Th>
                  <Th>{copy.suratlar.archive.departedOn}</Th>
                  <Th>{copy.suratlar.archive.pilgrims}</Th>
                  <Th>{copy.suratlar.archive.material}</Th>
                  <Th>
                    <span className="sr-only">{copy.suratlar.archive.view}</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    {...(item.slug === selected ? { 'aria-current': 'true' as const } : {})}
                    className={
                      item.slug === selected
                        ? 'border-t border-line bg-tint-soft'
                        : 'border-t border-line'
                    }
                  >
                    <td className="px-8 py-[18px] text-body text-ink">{item.label}</td>
                    <td className="px-8 py-[18px] text-bodySm text-body">
                      {formatDate(item.departedOn) ?? '—'}
                    </td>
                    <td className="px-8 py-[18px] text-bodySm text-body">
                      {item.pilgrimsCount === null ? '—' : String(item.pilgrimsCount)}
                    </td>
                    <td className="px-8 py-[18px] text-bodySm text-body">
                      {plural(copy.suratlar.photos, item.photoCount, lang)} ·{' '}
                      {plural(copy.suratlar.videos, item.videoCount, lang)}
                    </td>
                    <td className="px-8 py-[18px]">
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(item.slug);
                        }}
                        className="text-label font-black uppercase text-accent-text hover:underline"
                      >
                        {copy.suratlar.archive.view}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sixty-eight groups do not fit on one page, which is why the archive pages at all —
              the prototype promises the number and renders six rows. */}
          <LoadMore
            hasMore={groups.data?.meta.hasMore ?? false}
            busy={groups.isFetching}
            onLoadMore={() => {
              setPage((current) => current + 1);
            }}
            status={fill(copy.common.shown, {
              shown: items.length,
              total: stats?.groups ?? 0,
            })}
            className="mt-10"
          >
            {copy.common.showMore}
          </LoadMore>
        </Container>
      </Section>

      <Section space="md" className="pb-section-lg">
        <Container>
          <div
            data-surface="dark"
            className="grid grid-cols-[1.2fr_auto] items-center gap-[50px] rounded-block bg-dark-alt p-13 tab:grid-cols-1 tab:gap-8 mob:p-8"
          >
            <Heading level={2} size="h2Sm">
              {copy.suratlar.cta.title}
            </Heading>
            <Link to={path.yazylmak(lang)} className={buttonClass()}>
              {copy.suratlar.cta.button}
            </Link>
          </div>
        </Container>
      </Section>

      <Lightbox
        items={openable.map((photo) => ({
          id: String(photo.id),
          src: photo.media?.url ?? '',
          alt: photo.media?.alt ?? photo.caption,
          caption: photo.caption === '' ? undefined : photo.caption,
        }))}
        index={open}
        onIndexChange={setOpen}
        onClose={() => {
          setOpen(null);
        }}
        labels={{
          close: copy.suratlar.lightbox.close,
          previous: copy.suratlar.lightbox.previous,
          next: copy.suratlar.lightbox.next,
          counter: (current, total) => fill(copy.suratlar.lightbox.counter, { current, total }),
        }}
      />
    </>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th scope="col" className="px-8 py-[18px] text-label font-black uppercase text-muted">
      {children}
    </th>
  );
}

/**
 * One clip.
 *
 * Plays where it is, like the Global video page: the poster is an image and the `<video>` is
 * created on the first press, so a page of three clips does not spend a pilgrim's mobile data
 * fetching metadata for footage nobody has asked to watch. In the handoff the round play button
 * has no handler at all.
 */
function GroupVideo({ video, lang, slug }: { video: UmrahGroupMedia; lang: Lang; slug: string }) {
  const copy = copyFor(lang);
  const [playing, setPlaying] = useState(false);

  if (playing && video.media !== null) {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video
        src={video.media.url}
        {...(video.poster === null ? {} : { poster: video.poster.url })}
        controls
        autoPlay
        preload="metadata"
        className="h-[260px] w-full rounded-panel-sm object-cover"
      >
        {copy.suratlar.noPlayer}
      </video>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setPlaying(true);
      }}
      disabled={video.media === null}
      className="group relative block h-[260px] w-full overflow-hidden rounded-panel-sm"
    >
      <ImageSlot
        slotKey={`u-group-${slug}-video-${String(video.id)}`}
        brief={video.caption}
        media={video.poster === null ? null : { src: video.poster.url, alt: video.poster.alt }}
        className="size-full"
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-scrim to-transparent"
      />
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 flex size-[60px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent transition-transform duration-lift group-hover:scale-105"
      >
        <Icon name="play" size={20} className="text-accent-on" />
      </span>
      {video.caption !== '' && (
        <span className="absolute inset-x-0 bottom-0 p-5 text-left text-lead font-semibold text-dark-on">
          {video.caption}
        </span>
      )}
      <span className="sr-only">
        {copy.suratlar.playVideo}: {video.caption}
      </span>
    </button>
  );
}
