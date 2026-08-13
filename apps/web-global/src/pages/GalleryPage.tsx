import { type Lang } from '@charva/contracts';
import { Container, Eyebrow, Heading, ImageSlot, Lightbox, MosaicGrid, Section } from '@charva/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { galleryQuery } from '../api/queries';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { ALL, FilteredGrid } from '../components/FilteredGrid';
import { copyFor, fill } from '../i18n';
import { path } from '../lib/routes';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { useListSearch } from '../lib/useListSearch';

export interface GalleryPageProps {
  lang: Lang;
}

const PER_PAGE = 16;

/**
 * The gallery.
 *
 * Two things the prototype cannot do.
 *
 * The tiles are placed by `packMosaic` over whatever is visible, rather than by span values
 * authored against the unfiltered set of fourteen. Any filter in the prototype therefore leaves
 * holes; here the spans are an editor's request and the packer narrows anything that will not
 * fit (D-16). First-fit is chosen for prefix stability, so «показать ещё» appends a row instead
 * of rearranging the photographs somebody is already looking at (D-37).
 *
 * Every tile opens. In the handoff each one is an `<a href="#">` — on this page, on the
 * homepage strip and on the Umrah group mosaic — so clicking a photograph does nothing at all.
 */
export function GalleryPage({ lang }: GalleryPageProps) {
  const copy = copyFor(lang);
  const { filter, page, setFilter, nextPage } = useListSearch(path.gallery(lang));
  const [open, setOpen] = useState<number | null>(null);

  const query = useQuery(
    galleryQuery(lang, {
      ...(filter === ALL ? {} : { category: filter }),
      perPage: page * PER_PAGE,
    }),
  );

  useDocumentMeta(
    {
      title: copy.gallery.metaTitle,
      description: copy.gallery.metaDescription,
      pathAfterLang: '/gallery',
    },
    lang,
  );

  const items = query.data?.items ?? [];
  const labels: Record<string, string> = copy.categories;

  /** Only tiles with a photograph can be opened; the rest are still laid out at full size. */
  const openable = items.filter((item) => item.media !== null);

  return (
    <>
      <Breadcrumbs lang={lang} trail={[{ label: copy.gallery.breadcrumb }]} />

      <Section space="sm">
        <Container>
          <Eyebrow>{copy.brand}</Eyebrow>
          <Heading level={1} size="h1" className="mt-4">
            {copy.gallery.title}
          </Heading>
          <p className="mt-6 max-w-[620px] text-lead font-light text-body">{copy.gallery.lead}</p>
        </Container>
      </Section>

      <FilteredGrid
        lang={lang}
        filterLabel={copy.gallery.filterLabel}
        allLabel={copy.gallery.all}
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
        skeletonCount={8}
        skeletonClassName="h-[220px] rounded-media"
      >
        <MosaicGrid
          items={items.map((item) => {
            const openIndex = openable.findIndex((candidate) => candidate.id === item.id);

            return {
              id: String(item.id),
              spanCols: item.spanCols,
              spanRows: item.spanRows,
              content:
                item.media === null ? (
                  <ImageSlot
                    slotKey={`gallery-${String(item.id)}`}
                    brief={item.caption}
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
                      slotKey={`gallery-${String(item.id)}`}
                      brief={item.caption}
                      media={{ src: item.media.url, alt: item.media.alt }}
                      className="size-full"
                    />
                    {item.caption !== '' && (
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-scrim-strong to-transparent p-4 text-bodySm font-semibold text-dark-on">
                        {item.caption}
                      </span>
                    )}
                    {/* The accessible name says what pressing it does; the caption alone would
                        read as a label on a photograph rather than as a control. */}
                    <span className="sr-only">{copy.gallery.openPhoto}</span>
                  </button>
                ),
            };
          })}
        />
      </FilteredGrid>

      <Lightbox
        items={openable.map((item) => ({
          id: String(item.id),
          src: item.media?.url ?? '',
          alt: item.media?.alt ?? item.caption,
          caption: item.caption === '' ? undefined : item.caption,
        }))}
        index={open}
        onIndexChange={setOpen}
        onClose={() => {
          setOpen(null);
        }}
        labels={{
          close: copy.gallery.lightbox.close,
          previous: copy.gallery.lightbox.previous,
          next: copy.gallery.lightbox.next,
          // Built by the caller: «3 из 38» and «3 of 38» do not share a word order.
          counter: (current, total) => fill(copy.gallery.lightbox.counter, { current, total }),
        }}
      />
    </>
  );
}
