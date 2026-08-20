import { ApiRequestError, MAX_GALLERY_ITEMS } from '@charva/contracts';
import { Button, QueryState } from '@charva/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { mediaByIdsQuery, putGallery, rowsQuery } from '../api/queries';
import { copy, fill } from '../i18n/copy';

import { MediaPickerDialog } from './MediaPicker';
import { DropZone, useUpload } from './Upload';

/**
 * The photographs of one tour or one hotel, edited where the tour or the hotel is.
 *
 * `tour_media` has been a table since phase 2 and `hotel_media` is new, and both were reachable
 * only as a list of their own: to give a tour six photographs you created six rows, and in each
 * one you chose the tour again and set a position by hand. Nobody does that six times.
 *
 * Here it is a wall of tiles with an upload on it. Dropping four files uploads four files and
 * appends four tiles; the arrows move them; the cross removes one. Every one of those writes
 * the whole set through one endpoint, because the editor's act is «these ones, in this order»
 * rather than a sequence of row operations that can stop halfway.
 *
 * Captions are not here. They are translated prose, three languages deep, and a text box under
 * each of twelve tiles would be a worse editor for them than the row screen that already
 * exists — which stays in the menu for exactly that.
 */

export interface GalleryEditorProps {
  /** Which parent this gallery belongs to — the endpoint and the child table follow from it. */
  parent: 'tours' | 'hotels';
  parentId: number;
}

const CHILD: Record<GalleryEditorProps['parent'], { table: string; filter: string }> = {
  tours: { table: 'tour_media', filter: 'tourId' },
  hotels: { table: 'hotel_media', filter: 'hotelId' },
};

interface Item {
  mediaId: number;
  caption: Record<string, string> | null;
}

export function GalleryEditor({ parent, parentId }: GalleryEditorProps) {
  const child = CHILD[parent];
  const queryClient = useQueryClient();
  const [picking, setPicking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const rows = useQuery(
    rowsQuery(child.table, { [child.filter]: parentId, perPage: MAX_GALLERY_ITEMS }),
  );

  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    if (rows.data === undefined) return;
    setItems(
      rows.data.items.map((row) => ({
        mediaId: Number(row['mediaId']),
        caption: (row['caption'] ?? null) as Record<string, string> | null,
      })),
    );
  }, [rows.data]);

  const covers = useQuery(mediaByIdsQuery(items.map((item) => item.mediaId)));
  const byId = new Map((covers.data?.items ?? []).map((media) => [media.id, media]));

  const write = useMutation({
    mutationFn: (next: Item[]) => putGallery(parent, parentId, next),
    onSuccess: async () => {
      setFailure(null);
      await queryClient.invalidateQueries({ queryKey: ['rows', child.table] });
    },
    onError: (error) => {
      setFailure(error instanceof ApiRequestError ? error.message : copy.errors.offline);
    },
  });

  /** Optimistic on screen, authoritative on the server — the tiles must not lag a click. */
  function commit(next: Item[]): void {
    setItems(next);
    write.mutate(next);
  }

  function add(mediaIds: readonly number[]): void {
    const existing = new Set(items.map((item) => item.mediaId));
    const fresh = mediaIds
      .filter((id) => !existing.has(id))
      .map((id) => ({ mediaId: id, caption: null }));
    if (fresh.length === 0) return;
    // Silently trimmed rather than refused: somebody who drops fifteen files wants the twelve
    // that fit, and the counter below has been saying twelve the whole time.
    commit([...items, ...fresh].slice(0, MAX_GALLERY_ITEMS));
  }

  const upload = useUpload({
    onUploaded: (result) => {
      add([result.media.id]);
    },
  });

  const full = items.length >= MAX_GALLERY_ITEMS;

  function move(index: number, direction: -1 | 1): void {
    const target = index + direction;
    const current = items[index];
    const swap = items[target];
    if (current === undefined || swap === undefined) return;

    const next = [...items];
    next[index] = swap;
    next[target] = current;
    commit(next);
  }

  return (
    <section className="rounded-panel border border-line bg-surface px-5 py-5">
      <h2 className="m-0 mb-1 text-label font-bold uppercase tracking-[0.2em] text-muted">
        {copy.form.sections.gallery}
      </h2>
      <p className="m-0 mb-4 text-label text-muted">
        {fill(copy.form.galleryCount, { count: items.length, max: MAX_GALLERY_ITEMS })}
      </p>

      <QueryState
        isPending={rows.isPending}
        isError={rows.isError}
        onRetry={() => void rows.refetch()}
        labels={{
          loading: copy.list.loading,
          errorTitle: copy.list.failed,
          errorHint: copy.errors.offline,
          retry: copy.list.retry,
        }}
        skeletonCount={4}
        skeletonClassName="h-[96px] rounded-panel-sm"
        gridClassName="grid grid-cols-4 gap-3"
      >
        {items.length > 0 && (
          <ul className="mb-4 grid list-none grid-cols-4 gap-3 p-0 tab:grid-cols-3">
            {items.map((item, index) => {
              const media = byId.get(item.mediaId);
              return (
                <li
                  key={item.mediaId}
                  className="relative overflow-hidden rounded-panel-sm border border-line bg-field"
                >
                  {media === undefined ? (
                    <span className="flex aspect-[4/3] items-center justify-center text-label text-muted">
                      —
                    </span>
                  ) : (
                    <img
                      src={media.url}
                      alt={media.alt?.['ru'] ?? ''}
                      loading="lazy"
                      className="aspect-[4/3] w-full object-cover"
                    />
                  )}

                  <span className="flex items-center justify-between gap-1 px-1.5 py-1.5">
                    <span className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={copy.list.up}
                        disabled={index === 0 || write.isPending}
                        onClick={() => {
                          move(index, -1);
                        }}
                      >
                        ←
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={copy.list.down}
                        disabled={index === items.length - 1 || write.isPending}
                        onClick={() => {
                          move(index, 1);
                        }}
                      >
                        →
                      </Button>
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={copy.form.removePhoto}
                      disabled={write.isPending}
                      onClick={() => {
                        commit(items.filter((other) => other.mediaId !== item.mediaId));
                      }}
                    >
                      ✕
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </QueryState>

      {full ? (
        <p className="m-0 text-label text-muted">
          {fill(copy.form.galleryFull, { max: MAX_GALLERY_ITEMS })}
        </p>
      ) : (
        <>
          <DropZone
            label={copy.form.addPhotos}
            hint={copy.media.dropHint}
            busy={upload.progress !== null || write.isPending}
            onFiles={(files) => void upload.send(files)}
          />
          <Button
            size="sm"
            variant="ghost"
            className="mt-2"
            onClick={() => {
              setPicking(true);
            }}
          >
            {copy.form.fromLibrary}
          </Button>
        </>
      )}

      {(failure ?? upload.notice) !== null && (
        <p className="mt-3 text-bodySm text-danger">{failure ?? upload.notice}</p>
      )}

      {picking && (
        <MediaPickerDialog
          title={copy.form.sections.gallery}
          kind="image"
          onPick={(media) => {
            add([media.id]);
            setPicking(false);
          }}
          onClose={() => {
            setPicking(false);
          }}
        />
      )}
    </section>
  );
}
