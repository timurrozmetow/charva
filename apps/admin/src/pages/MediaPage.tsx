import { type AdminMedia, ApiRequestError } from '@charva/contracts';
import { Badge, Button, EmptyState, Field, Input, Modal, QueryState } from '@charva/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { mediaQuery, patchMedia, uploadMedia } from '../api/queries';
import { useSession } from '../auth/SessionProvider';
import { copy } from '../i18n/copy';
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
  const [notice, setNotice] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { can } = useSession();

  const media = useQuery(mediaQuery({ perPage: 48, ...(kind === 'all' ? {} : { kind }) }));

  const upload = useMutation({
    mutationFn: (file: File) => uploadMedia(file),
    onSuccess: async (result) => {
      setNotice(result.isDuplicate ? copy.media.duplicate : null);
      await queryClient.invalidateQueries({ queryKey: ['media'] });
    },
    onError: (error) => {
      setNotice(error instanceof ApiRequestError ? error.message : copy.errors.offline);
    },
  });

  return (
    <>
      <PageHead
        title={copy.media.title}
        lead={copy.media.lead}
        {...(media.data === undefined ? {} : { count: media.data.meta.total })}
        action={
          can('media.write') ? (
            <>
              <input
                ref={fileInput}
                type="file"
                className="hidden"
                accept="image/*,video/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file !== undefined) upload.mutate(file);
                  event.target.value = '';
                }}
              />
              <Button
                busy={upload.isPending}
                busyLabel={copy.media.uploading}
                onClick={() => fileInput.current?.click()}
              >
                {copy.media.upload}
              </Button>
            </>
          ) : undefined
        }
      />

      {notice !== null && (
        <p className="mb-6 rounded-panel-sm border border-tint-line bg-tint px-4 py-3 text-bodySm text-accent-text">
          {notice}
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
        skeletonClassName="h-[160px] rounded-panel-sm"
        gridClassName="grid grid-cols-6 gap-4 lap:grid-cols-4 tab:grid-cols-3 mob:grid-cols-2"
      >
        {(media.data?.items.length ?? 0) === 0 ? (
          <EmptyState title={copy.list.empty} description={copy.media.lead} />
        ) : (
          <ul className="grid list-none grid-cols-6 gap-4 p-0 lap:grid-cols-4 tab:grid-cols-3 mob:grid-cols-2">
            {(media.data?.items ?? []).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(item);
                  }}
                  className="w-full overflow-hidden rounded-panel-sm border border-line bg-surface text-left"
                >
                  <MediaThumb media={item} />
                  <span className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="truncate text-label text-muted">{item.storageKey}</span>
                    {item.isPlaceholder && <Badge variant="scrim">врем.</Badge>}
                  </span>
                </button>
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

export function MediaThumb({ media, className }: { media: AdminMedia; className?: string }) {
  if (media.mime.startsWith('video/')) {
    return (
      <span
        className={
          className ??
          'flex h-[110px] w-full items-center justify-center bg-dark text-label uppercase tracking-[0.2em] text-dark-on'
        }
      >
        video · {media.durationSec ?? 0}s
      </span>
    );
  }

  return (
    <img
      src={`/img/${media.storageKey}?w=320`}
      alt={media.alt?.['ru'] ?? ''}
      loading="lazy"
      className={className ?? 'h-[110px] w-full object-cover'}
    />
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

  return (
    <Modal open onClose={onClose} title={media.storageKey} closeLabel={copy.form.cancel}>
      <div className="flex flex-col gap-5">
        <MediaThumb
          media={media}
          className="max-h-[320px] w-full rounded-panel-sm object-contain"
        />

        <dl className="grid grid-cols-2 gap-2 text-bodySm text-muted">
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
