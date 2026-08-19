import { type AdminMedia, ApiRequestError } from '@charva/contracts';
import { Button, cn } from '@charva/ui';
import { useQueryClient } from '@tanstack/react-query';
import { type DragEvent, useRef, useState } from 'react';

import { uploadMedia } from '../api/queries';
import { copy } from '../i18n/copy';

/**
 * Getting a photograph into the system, in as few movements as possible.
 *
 * It used to be one file at a time through a hidden `<input>`, on one screen. Attaching a cover
 * to a tour meant: leave the tour, open the library, press upload, choose the file, wait, go
 * back to the tour, open the picker, find the file again. Six movements for one photograph, and
 * five of them exist only because the upload lived somewhere else.
 *
 * So: several files at once, dropped anywhere on the target, and the same control inside the
 * picker dialog — where the file it uploads is chosen immediately, because somebody who uploads
 * a photograph while choosing one has already told you which one they want.
 */

export interface UploadResult {
  media: AdminMedia;
  isDuplicate: boolean;
}

export interface UseUploadOptions {
  onUploaded?: (result: UploadResult) => void;
}

export interface UploadState {
  /** How many of this batch are done, and how many there are. Null when nothing is running. */
  progress: { done: number; total: number } | null;
  notice: string | null;
  clearNotice: () => void;
  send: (files: readonly File[]) => Promise<void>;
}

export function useUpload({ onUploaded }: UseUploadOptions = {}): UploadState {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function send(files: readonly File[]): Promise<void> {
    if (files.length === 0) return;

    setProgress({ done: 0, total: files.length });
    setNotice(null);
    let duplicates = 0;

    /*
     * One at a time, not `Promise.all`.
     *
     * Each upload is converted and hashed by the server, and ten at once on a phone connection
     * is how a batch turns into ten timeouts. Sequential also means the count below is honest
     * about what has actually landed.
     */
    for (const [index, file] of files.entries()) {
      try {
        const result = await uploadMedia(file);
        if (result.isDuplicate) duplicates += 1;
        onUploaded?.({ media: result.media, isDuplicate: result.isDuplicate });
      } catch (error) {
        setNotice(error instanceof ApiRequestError ? error.message : copy.errors.offline);
        break;
      }
      setProgress({ done: index + 1, total: files.length });
    }

    await queryClient.invalidateQueries({ queryKey: ['media'] });
    setProgress(null);
    if (duplicates > 0) setNotice(copy.media.duplicate);
  }

  return {
    progress,
    notice,
    clearNotice: () => {
      setNotice(null);
    },
    send,
  };
}

export interface DropZoneProps {
  onFiles: (files: readonly File[]) => void;
  busy?: boolean;
  /** What the button says. The area around it is droppable either way. */
  label: string;
  hint?: string;
  className?: string;
}

/**
 * A rectangle that takes a dropped file, and a button for everyone who would rather click.
 *
 * Both, not one: dragging is faster when the file is already visible on the desktop, and the
 * file dialog is the only route on a machine where it is not.
 */
export function DropZone({ onFiles, busy = false, label, hint, className }: DropZoneProps) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function accept(list: FileList | null): void {
    const files = [...(list ?? [])];
    if (files.length > 0) onFiles(files);
  }

  function stop(event: DragEvent): void {
    // Without both, the browser navigates to the dropped file and the page is simply gone.
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    /*
     * A drop target, not a control.
     *
     * The keyboard route to this is the button inside it, which is why the region itself takes
     * only drag events: `role="button"` on the box would put a second, identical stop in the
     * tab order that does nothing a keyboard can trigger. Dropping a file is a pointer gesture
     * with no keyboard equivalent to mirror.
     */
    <div
      role="presentation"
      onDragOver={(event) => {
        stop(event);
        setOver(true);
      }}
      onDragLeave={(event) => {
        stop(event);
        setOver(false);
      }}
      onDrop={(event) => {
        stop(event);
        setOver(false);
        accept(event.dataTransfer.files);
      }}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-panel border border-dashed px-6 py-7 text-center',
        'transition-colors duration-colour',
        over ? 'border-accent bg-tint' : 'border-line-strong bg-surface',
        className,
      )}
    >
      <input
        ref={input}
        type="file"
        multiple
        className="hidden"
        accept="image/*,video/*"
        onChange={(event) => {
          accept(event.target.files);
          // Cleared, so choosing the same file twice in a row still fires a change.
          event.target.value = '';
        }}
      />

      <Button
        size="sm"
        variant="outline"
        busy={busy}
        busyLabel={copy.media.uploading}
        onClick={() => input.current?.click()}
      >
        {label}
      </Button>
      <p className="m-0 text-label text-muted">{hint ?? copy.media.dropHint}</p>
    </div>
  );
}
