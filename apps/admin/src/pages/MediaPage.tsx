import { type AdminMedia, imageUrl } from '@charva/contracts';
import { Badge, Button, cn, EmptyState, Field, Input, Modal, QueryState } from '@charva/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { mediaQuery, patchMedia } from '../api/queries';
import { useSession } from '../auth/SessionProvider';
import { DropZone, useUpload } from '../components/Upload';
import { copy, fill } from '../i18n/copy';
import { PageHead } from '../layout/Shell';

/**
 * The library.
 *
 * Everything that has been uploaded, newest first, with the two fields worth editing after the
 * fact: what the picture shows, in each language, and whether it is a stand-in that must not
 * reach production (decision D-25).
 *
 * The alternative text is here rather than on the slot because one photograph can hang in
 * several places, and describing it twice is how two descriptions of one picture come to
 * disagree.
 */
export function MediaPage() {
  const [kind, setKind] = useState<'all' | 'image' | 'video'>('all');
  const [selected, setSelected] = useState<AdminMedia | null>(null);
  const { can } = useSession();

  const media = useQuery(mediaQuery({ perPage: 48, ...(kind === 'all' ? {} : { kind }) }));
  const upload = useUpload();
  const writable = can('media.write');

  return (
    <>
      <PageHead
        title={copy.media.title}
        lead={copy.media.lead}
        {...(media.data === undefined ? {} : { count: media.data.meta.total })}
      />

      {/* The drop zone is the whole action, at the top of the page rather than a button in the
          corner: this screen exists to receive files. */}
      {writable && (
        <DropZone
          className="mb-6"
          label={copy.media.upload}
          busy={upload.progress !== null}
          onFiles={(files) => void upload.send(files)}
        />
      )}

      {upload.progress !== null && (
        <p className="mb-6 text-bodySm text-muted">
          {fill(copy.media.uploadingCount, upload.progress)}
        </p>
      )}

      {upload.notice !== null && (
        <p className="mb-6 rounded-panel-sm border border-tint-line bg-tint px-4 py-3 text-bodySm text-accent-text">
          {upload.notice}
        </p>
      )}

      <div className="mb-6 flex gap-2">
        {(['all', 'image', 'video'] as const).map((option) => (
          <Button
            key={option}
            size="sm"
            variant={kind === option ? 'solid' : 'outline'}
            onClick={() => {
              setKind(option);
            }}
          >
            {option === 'all'
              ? copy.media.all
              : option === 'image'
                ? copy.media.onlyImages
                : copy.media.onlyVideos}
          </Button>
        ))}
      </div>

      <QueryState
        isPending={media.isPending}
        isError={media.isError}
        onRetry={() => void media.refetch()}
        labels={{
          loading: copy.list.loading,
          errorTitle: copy.list.failed,
          errorHint: copy.errors.offline,
          retry: copy.list.retry,
        }}
        skeletonCount={12}
        skeletonClassName="h-[240px] rounded-panel"
        gridClassName={GRID}
      >
        {(media.data?.items.length ?? 0) === 0 ? (
          <EmptyState title={copy.list.empty} description={copy.media.lead} />
        ) : (
          <ul className={`${GRID} list-none p-0`}>
            {(media.data?.items ?? []).map((item) => (
              <li key={item.id}>
                <MediaCard
                  media={item}
                  onOpen={() => {
                    setSelected(item);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </QueryState>

      {selected !== null && (
        <MediaDetails
          media={selected}
          onClose={() => {
            setSelected(null);
          }}
        />
      )}
    </>
  );
}

/*
 * Cards sized by the grid, not by the window.
 *
 * Six fixed columns made a card as wide as the screen divided by six — on a 3440px monitor that
 * is a 540px-wide picture squeezed into 110px of height, which is a letterbox rather than a
 * thumbnail. `auto-fill` keeps one card the same size everywhere and puts as many in a row as
 * fit, which is what a media library is: a wall of pictures at a readable size.
 */
const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4';

export function MediaThumb({ media, className }: { media: AdminMedia; className?: string }) {
  if (media.mime.startsWith('video/')) {
    return (
      <span
        className={cn(
          'flex items-center justify-center bg-dark text-label uppercase tracking-[0.2em] text-dark-on',
          className ?? 'aspect-[4/3] w-full',
        )}
      >
        video · {media.durationSec ?? 0}s
      </span>
    );
  }

  return (
    <img
      src={imageUrl(media.storageKey, 640)}
      alt={media.alt?.['ru'] ?? ''}
      loading="lazy"
      // The fit belongs to whichever class list wins, so it is never written twice: `cn` is
      // clsx, and `object-cover` here beside a caller's `object-contain` would be decided by
      // the stylesheet rather than by the caller (decision D-90).
      className={cn('bg-field', className ?? 'aspect-[4/3] w-full object-cover')}
    />
  );
}

/** `2026/08/834f273f00da.webp` → `834f273f00da.webp`. The year and month are storage, not a name. */
function fileName(storageKey: string): string {
  return storageKey.split('/').at(-1) ?? storageKey;
}

/**
 * One file.
 *
 * The card used to be a strip of photograph with its storage key printed underneath — twelve
 * characters of checksum, identical in shape for every row, and the only thing a person could
 * read. What identifies a picture to the person looking for it is the picture, then what it
 * shows; so the description leads, the file name is the fallback when nothing has described it
 * yet, and the checksum is left to the dialog, where it is a fact rather than a label.
 */
function MediaCard({ media, onOpen }: { media: AdminMedia; onOpen: () => void }) {
  const described = media.alt?.['ru']?.trim() ?? '';
  const isVideo = media.mime.startsWith('video/');

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full flex-col overflow-hidden rounded-panel border border-line bg-surface text-left transition-colors duration-colour hover:border-line-strong"
    >
      <span className="relative block overflow-hidden">
        <MediaThumb media={media} />

        {(media.isPlaceholder || isVideo) && (
          <span className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
            {isVideo && <Badge variant="scrim">видео</Badge>}
            {media.isPlaceholder && <Badge variant="scrim">временное</Badge>}
          </span>
        )}
      </span>

      <span className="flex min-w-0 flex-col gap-1 px-3.5 py-3">
        {/* Two lines at most: a description long enough to wrap forever would set every card in
            the row to its height. */}
        <span
          className={cn(
            'line-clamp-2 text-bodySm',
            described === '' ? 'break-all text-muted' : 'text-ink',
          )}
        >
          {described === '' ? fileName(media.storageKey) : described}
        </span>
        <span className="text-label uppercase tracking-[0.14em] text-muted">
          {media.width ?? '—'}×{media.height ?? '—'} · {Math.round(media.sizeBytes / 1024)} КБ
        </span>
      </span>
    </button>
  );
}

function MediaDetails({ media, onClose }: { media: AdminMedia; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { can } = useSession();
  const [alt, setAlt] = useState<Record<string, string>>(media.alt ?? {});
  const [isPlaceholder, setIsPlaceholder] = useState(media.isPlaceholder);

  const save = useMutation({
    mutationFn: () => patchMedia(media.id, { alt, isPlaceholder }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['media'] });
      onClose();
    },
  });

  /*
   * The dialog is titled with the file name, not the storage key.
   *
   * The key is `2026/08/834f273f00da.webp` — a year, a month and twelve characters of a
   * checksum — and as a heading it set itself across the whole width, collided with the close
   * button and told the reader nothing they could act on. The full key is a row in the table
   * below, where it is a fact rather than a title.
   */
  return (
    <Modal open onClose={onClose} title={fileName(media.storageKey)} closeLabel={copy.form.cancel}>
      <div className="flex flex-col gap-7">
        <MediaThumb
          media={media}
          className="max-h-[320px] w-full rounded-panel-sm object-contain"
        />

        {/* Rows breathe: a label and a value on one line at 8px apart read as one smudge. */}
        <dl className="grid grid-cols-[130px_1fr] gap-x-6 gap-y-3 text-bodySm text-muted">
          <dt>{copy.media.path}</dt>
          {/* Where the file actually is, for anybody who has to find it on disk or in a
              backup. `break-all` because it has no spaces to wrap at. */}
          {/* No `font-mono`: the preset defines Stolzl and nothing else, so the class produces
              no rule at all — which the class audit said the moment it was written. */}
          <dd className="break-all text-[12px] text-ink">{media.storageKey}</dd>
          <dt>{copy.media.size}</dt>
          <dd>{Math.round(media.sizeBytes / 1024)} КБ</dd>
          <dt>{copy.media.dimensions}</dt>
          <dd>
            {media.width ?? '—'} × {media.height ?? '—'}
          </dd>
          {media.durationSec !== null && (
            <>
              <dt>{copy.media.duration}</dt>
              <dd>{media.durationSec} с</dd>
            </>
          )}
        </dl>

        <Field label={copy.media.alt} hint={copy.media.altHint}>
          <Input
            value={alt['ru'] ?? ''}
            onChange={(event) => {
              setAlt({ ...alt, ru: event.target.value });
            }}
          />
        </Field>

        <label className="flex items-center gap-3 text-bodySm text-body">
          <input
            type="checkbox"
            checked={isPlaceholder}
            onChange={(event) => {
              setIsPlaceholder(event.target.checked);
            }}
          />
          {copy.media.placeholder} — {copy.media.placeholderHint}
        </label>

        {can('media.write') && (
          <Button
            busy={save.isPending}
            onClick={() => {
              save.mutate();
            }}
          >
            {copy.form.save}
          </Button>
        )}
      </div>
    </Modal>
  );
}
