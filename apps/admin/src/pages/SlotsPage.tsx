import { type AdminSlot, type Site } from '@charva/contracts';
import { Badge, Button, EmptyState, ProgressBar, QueryState } from '@charva/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';

import { attachSlot, slotsQuery } from '../api/queries';
import { useSession } from '../auth/SessionProvider';
import { MediaPickerDialog } from '../components/MediaPicker';
import { copy } from '../i18n/copy';
import { PageHead } from '../layout/Shell';

import { MediaThumb } from './MediaPage';

/**
 * The 174 photographs the design asks for, as a list somebody can finish.
 *
 * This screen is the reason `content_slots` is a table (decision D-21). Without it, «there are
 * no photographs» is a sentence in a risk register that nobody can act on; with it, Q-1 has a
 * number that moves, each row carries the art direction the prototype wrote, and a page renders
 * at its real proportions in the meantime.
 */
/** The URL is a string from outside; `?site=nonsense` narrows to nothing rather than crashing. */
function isSite(value: string | undefined): value is Site {
  return value === 'global' || value === 'umrah' || value === 'choice';
}

export function SlotsPage() {
  /*
   * The site lives in the URL, the status does not.
   *
   * The site is how a department reaches this screen — «Фотографии умры» is a link, not a
   * filter somebody has to set after arriving — so it has to be part of the address. The
   * status is a glance somebody takes while already here.
   */
  const search: { site?: string } = useSearch({ strict: false });
  const navigate = useNavigate();
  const site: Site | 'all' = isSite(search.site) ? search.site : 'all';

  const [status, setStatus] = useState<'all' | 'filled' | 'empty'>('all');
  const [picking, setPicking] = useState<AdminSlot | null>(null);
  const { can } = useSession();

  const slots = useQuery(
    slotsQuery({
      perPage: 200,
      ...(site === 'all' ? {} : { site }),
      ...(status === 'all' ? {} : { status }),
    }),
  );

  const progress = slots.data?.progress;

  return (
    <>
      <PageHead title={copy.slots.title} lead={copy.slots.lead} />

      {progress !== undefined && (
        <div className="mb-8 max-w-[520px]">
          <p className="mb-2 flex items-baseline justify-between text-bodySm text-muted">
            <span>{copy.slots.filled}</span>
            <span className="text-ink">
              {progress.filled} {copy.list.of} {progress.total}
            </span>
          </p>
          <ProgressBar
            value={progress.filled}
            max={progress.total}
            label={copy.slots.filled}
            valueText={`${String(progress.filled)} ${copy.list.of} ${String(progress.total)}`}
          />
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {(['all', 'global', 'umrah', 'choice'] as const).map((option) => (
          <Button
            key={option}
            size="sm"
            variant={site === option ? 'solid' : 'outline'}
            onClick={() => {
              void navigate({
                to: '/slots',
                search: option === 'all' ? {} : { site: option },
              });
            }}
          >
            {option === 'all' ? copy.slots.all : option}
          </Button>
        ))}
        <span className="mx-2 w-px bg-line" aria-hidden="true" />
        {(['all', 'empty', 'filled'] as const).map((option) => (
          <Button
            key={option}
            size="sm"
            variant={status === option ? 'solid' : 'outline'}
            onClick={() => {
              setStatus(option);
            }}
          >
            {option === 'all'
              ? copy.slots.all
              : option === 'empty'
                ? copy.slots.empty
                : copy.slots.filled}
          </Button>
        ))}
      </div>

      <QueryState
        isPending={slots.isPending}
        isError={slots.isError}
        onRetry={() => void slots.refetch()}
        labels={{
          loading: copy.list.loading,
          errorTitle: copy.list.failed,
          errorHint: copy.errors.offline,
          retry: copy.list.retry,
        }}
        skeletonCount={8}
        skeletonClassName="h-[92px] rounded-panel-sm"
        gridClassName="flex flex-col gap-3"
      >
        {(slots.data?.items.length ?? 0) === 0 ? (
          <EmptyState title={copy.list.empty} description={copy.slots.lead} />
        ) : (
          <ul className="flex list-none flex-col gap-3 p-0">
            {(slots.data?.items ?? []).map((slot) => (
              <li
                key={slot.id}
                className="flex items-center gap-5 rounded-panel-sm border border-line bg-surface p-3"
              >
                <span className="h-[64px] w-[96px] shrink-0 overflow-hidden rounded-panel-sm bg-field">
                  {slot.media === null ? (
                    <span className="flex h-full items-center justify-center text-label uppercase tracking-[0.2em] text-muted">
                      —
                    </span>
                  ) : (
                    <MediaThumb media={slot.media} className="h-full w-full object-cover" />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge variant="tint">{slot.site}</Badge>
                    <span className="text-label uppercase tracking-[0.16em] text-muted">
                      {slot.page} / {slot.slotKey}
                    </span>
                  </span>
                  {/* The art direction, verbatim from the prototype. It is what makes this a
                      brief rather than a list of empty boxes. */}
                  <span className="mt-1 block truncate text-bodySm text-body">{slot.brief}</span>
                  {slot.recommendedWidth !== null && (
                    <span className="mt-1 block text-label text-muted">
                      {copy.slots.recommended}: {slot.recommendedWidth}×
                      {slot.recommendedHeight ?? '—'}
                    </span>
                  )}
                </span>

                {can('media.write') && (
                  <Button
                    size="sm"
                    variant={slot.media === null ? 'solid' : 'outline'}
                    onClick={() => {
                      setPicking(slot);
                    }}
                  >
                    {slot.media === null ? copy.slots.attach : copy.form.pickMedia}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </QueryState>

      {picking !== null && (
        <SlotPicker
          slot={picking}
          onClose={() => {
            setPicking(null);
          }}
        />
      )}
    </>
  );
}

/**
 * The same grid the forms use.
 *
 * It had its own copy — a bare wall of thumbnails with no search and no captions — while the
 * cover picker on a tour had another. One dialog, so a photograph is found the same way
 * wherever it is being attached.
 */
function SlotPicker({ slot, onClose }: { slot: AdminSlot; onClose: () => void }) {
  const queryClient = useQueryClient();

  const attach = useMutation({
    mutationFn: (mediaId: number | null) => attachSlot(slot.id, mediaId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['slots'] });
      onClose();
    },
  });

  return (
    <MediaPickerDialog
      title={slot.slotKey}
      hint={slot.brief}
      kind="image"
      onClose={onClose}
      onPick={(picked) => {
        attach.mutate(picked.id);
      }}
      extra={
        slot.media !== null ? (
          <Button
            variant="outline"
            size="sm"
            busy={attach.isPending}
            onClick={() => {
              attach.mutate(null);
            }}
          >
            {copy.slots.detach}
          </Button>
        ) : undefined
      }
    />
  );
}
