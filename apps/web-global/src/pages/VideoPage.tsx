import { type Lang, type Video } from '@charva/contracts';
import { Container, Eyebrow, Heading, Section } from '@charva/ui';
import { useQuery } from '@tanstack/react-query';

import { videosQuery } from '../api/queries';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { ALL, FilteredGrid } from '../components/FilteredGrid';
import { VideoPlayer } from '../components/VideoPlayer';
import { copyFor, plural } from '../i18n';
import { path } from '../lib/routes';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { useListSearch } from '../lib/useListSearch';

export interface VideoPageProps {
  lang: Lang;
}

const PER_PAGE = 9;

/**
 * The video page — a dark section, as the design draws it.
 *
 * `<Section tone="dark">` sets `data-surface="dark"`, which re-points nine theme variables, so
 * every card, hairline and muted line inside renders for a dark backdrop without any component
 * being told (D-29). The prototype writes those colours as literals on each element.
 */
export function VideoPage({ lang }: VideoPageProps) {
  const copy = copyFor(lang);
  const { filter, page, setFilter, nextPage } = useListSearch(path.video(lang));

  const query = useQuery(
    videosQuery(lang, {
      ...(filter === ALL ? {} : { category: filter }),
      perPage: page * PER_PAGE,
    }),
  );

  useDocumentMeta(
    {
      title: copy.video.metaTitle,
      description: copy.video.metaDescription,
      pathAfterLang: '/video',
    },
    lang,
  );

  const items = query.data?.items ?? [];
  const labels: Record<string, string> = copy.categories;

  return (
    <Section tone="dark" space="none" className="pb-section">
      <Breadcrumbs lang={lang} trail={[{ label: copy.video.breadcrumb }]} />

      <Section space="sm">
        <Container>
          <Eyebrow>{copy.brand}</Eyebrow>
          <Heading level={1} size="h1" className="mt-4">
            {copy.video.title}
          </Heading>
          <p className="mt-6 max-w-[620px] text-lead font-light text-body">{copy.video.lead}</p>
        </Container>
      </Section>

      <FilteredGrid
        lang={lang}
        filterLabel={copy.video.filterLabel}
        allLabel={copy.video.all}
        facets={query.data?.facets.categories ?? []}
        labelFor={(code) => labels[code] ?? code}
        value={filter}
        onValueChange={setFilter}
        shown={items.length}
        total={query.data?.meta.total ?? 0}
        hasMore={query.data?.meta.hasMore ?? false}
        onLoadMore={nextPage}
        isPending={query.isPending}
        isFetching={query.isFetching}
        isError={query.isError}
        onRetry={() => void query.refetch()}
      >
        <ul className="grid list-none grid-cols-3 gap-6 p-0 lap:grid-cols-2 mob:grid-cols-1">
          {items.map((video) => (
            <li key={video.id}>
              <VideoCard video={video} lang={lang} />
            </li>
          ))}
        </ul>
      </FilteredGrid>
    </Section>
  );
}

function VideoCard({ video, lang }: { video: Video; lang: Lang }) {
  const copy = copyFor(lang);

  return (
    <article className="flex h-full flex-col gap-4 overflow-hidden rounded-card border border-line bg-surface">
      <VideoPlayer video={video} lang={lang} className="aspect-video w-full" />

      <div className="flex flex-col gap-2 px-5 pb-6">
        <h2 className="text-cardTitle font-medium text-ink">{video.title}</h2>
        {video.description !== '' && (
          <p className="text-bodySm font-light text-body">{video.description}</p>
        )}

        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-label text-muted">
          {/*
            Two fields, not one string.

            The homepage's copy of this card merges duration and views into a single `meta`
            string, so neither can be sorted, summed or written differently in another language.
            `duration_sec` is a number here and the clock is rendered from it.
          */}
          {video.durationSec !== null && (
            <time dateTime={`PT${String(video.durationSec)}S`}>
              {formatDuration(video.durationSec)}
            </time>
          )}
          {video.durationSec !== null && video.viewCount > 0 && <span aria-hidden="true">·</span>}
          {video.viewCount > 0 && <span>{plural(copy.video.views, video.viewCount, lang)}</span>}
        </p>
      </div>
    </article>
  );
}

/** 372 → «6:12», 3723 → «1:02:03». The hour only appears when there is one. */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const rest = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');

  return hours > 0
    ? `${String(hours)}:${pad(minutes)}:${pad(rest)}`
    : `${String(minutes)}:${pad(rest)}`;
}
