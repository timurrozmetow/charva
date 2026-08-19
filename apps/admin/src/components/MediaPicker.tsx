import { type AdminMedia } from '@charva/contracts';
import { Button, EmptyState, Input, Modal, QueryState } from '@charva/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { mediaByIdsQuery, mediaQuery } from '../api/queries';
import { copy } from '../i18n/copy';
import { MediaThumb } from '../pages/MediaPage';

/**
 * Choosing a photograph by looking at photographs.
 *
 * `coverMediaId` is an integer in the database and was an integer in the form: to give a tour a
 * cover you had to open the library in another tab, find the picture, and copy its number. That
 * is not a field an editor can fill in — it is a lookup they have to perform — and it was the
 * clearest single instance of the admin showing the schema instead of the work.
 *
 * The dialog is shared with the slots screen, which had its own copy of the same grid.
 */

export interface MediaPickerDialogProps {
  title: string;
  hint?: string | undefined;
  /** Only photographs, for a cover; both, for a gallery slot. */
  kind?: 'image' | 'video' | undefined;
  onPick: (media: AdminMedia) => void;
  onClose: () => void;
  /** Rendered above the grid — «убрать текущий», when there is one. */
  extra?: React.ReactNode;
}

export function MediaPickerDialog({
  title,
  hint,
  kind,
  onPick,
  onClose,
  extra,
}: MediaPickerDialogProps) {
  const [term, setTerm] = useState('');
  const media = useQuery(
    mediaQuery({
      perPage: 60,
      ...(kind === undefined ? {} : { kind }),
      ...(term.trim() === '' ? {} : { q: term.trim() }),
    }),
  );

  return (
    <Modal open onClose={onClose} title={title} closeLabel={copy.form.cancel} size="wide">
      {hint !== undefined && <p className="mb-5 text-bodySm text-muted">{hint}</p>}

      <div className="mb-5 flex items-center gap-3">
        <Input
          type="search"
          value={term}
          placeholder={copy.list.search}
          aria-label={copy.list.search}
          className="max-w-[320px]"
          onChange={(event) => {
            setTerm(event.target.value);
          }}
        />
        {extra}
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
        skeletonCount={10}
        skeletonClassName="h-[120px] rounded-panel-sm"
        gridClassName="grid grid-cols-5 gap-3 tab:grid-cols-3"
      >
        {(media.data?.items.length ?? 0) === 0 ? (
          <EmptyState title={copy.list.empty} description={copy.media.lead} />
        ) : (
          <ul className="grid max-h-[52vh] list-none grid-cols-5 gap-3 overflow-y-auto p-0 tab:grid-cols-3">
            {(media.data?.items ?? []).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(item);
                  }}
                  className="w-full overflow-hidden rounded-panel-sm border border-line transition-colors duration-colour hover:border-accent"
                >
                  <MediaThumb media={item} className="aspect-[4/3] w-full object-cover" />
                  {/* The description, not the checksum: it is what tells two crater photographs
                      apart, and the file name never has. */}
                  <span className="block truncate px-2 py-1.5 text-left text-label text-muted">
                    {item.alt?.['ru']?.trim() ?? item.storageKey.split('/').at(-1) ?? ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </Modal>
  );
}

export interface MediaPickerFieldProps {
  label: string;
  value: number | null;
  onChange: (id: number | null) => void;
  required?: boolean;
  error?: string | undefined;
}

/** The picture itself as the control: what is chosen, and two buttons. */
export function MediaPickerField({
  label,
  value,
  onChange,
  required = false,
  error,
}: MediaPickerFieldProps) {
  const [open, setOpen] = useState(false);
  const current = useQuery(mediaByIdsQuery(value === null ? [] : [value]));
  const media = current.data?.items[0];

  return (
    <div>
      <p className="mb-2 text-bodySm font-medium text-ink">
        {label}
        {required && <span className="text-danger"> *</span>}
      </p>

      <div className="flex items-start gap-4 rounded-panel-sm border border-line bg-surface p-3">
        <span className="block w-[124px] shrink-0 overflow-hidden rounded-panel-sm bg-field">
          {media === undefined ? (
            <span className="flex aspect-[4/3] items-center justify-center text-label uppercase tracking-[0.16em] text-muted">
              {copy.form.notChosen}
            </span>
          ) : (
            <MediaThumb media={media} className="aspect-[4/3] w-full object-cover" />
          )}
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="truncate text-bodySm text-body">
            {media === undefined ? copy.form.noMedia : (media.alt?.['ru'] ?? media.storageKey)}
          </span>
          <span className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setOpen(true);
              }}
            >
              {value === null ? copy.form.pickMedia : copy.form.replaceMedia}
            </Button>
            {value !== null && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  onChange(null);
                }}
              >
                {copy.form.clearMedia}
              </Button>
            )}
          </span>
        </span>
      </div>

      {error !== undefined && <p className="mt-2 text-[13px] font-medium text-danger">{error}</p>}

      {open && (
        <MediaPickerDialog
          title={label}
          kind="image"
          onPick={(picked) => {
            onChange(picked.id);
            setOpen(false);
          }}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
