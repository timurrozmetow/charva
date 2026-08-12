import { type ReactNode, useEffect } from 'react';

import { cn } from '../cn';

import { Modal } from './Modal';

export interface LightboxItem {
  id: string;
  src: string;
  /** Required. A photograph with no alternative text is a dead end for a screen reader. */
  alt: string;
  caption?: ReactNode;
}

export interface LightboxLabels {
  close: string;
  previous: string;
  next: string;
  /** «3 из 38». Built by the caller because the word order is not the same in four languages. */
  counter: (current: number, total: number) => string;
}

export interface LightboxProps {
  items: readonly LightboxItem[];
  /** Index of the open photograph, or null when closed. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  labels: LightboxLabels;
}

/**
 * The full-screen photograph viewer.
 *
 * Every gallery tile in the handoff is an `<a href="#">`, on both sites — the Global gallery
 * page, the homepage mosaic and the Umrah group mosaic — so a visitor who clicks a photograph
 * gets nothing at all. This is the whole of that interaction.
 *
 * It wraps `Modal`, so the focus trap, the scroll lock, Escape and the return of focus are the
 * same code the dialogs use. What it adds is the left and right arrows, which is what anyone
 * looking at thirty-eight photographs of a pilgrimage will actually reach for.
 */
export function Lightbox({ items, index, onIndexChange, onClose, labels }: LightboxProps) {
  const open = index !== null && items.length > 0;

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        onIndexChange((index + 1) % items.length);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onIndexChange((index - 1 + items.length) % items.length);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, index, items.length, onIndexChange]);

  if (!open) return null;

  const item = items[index];
  if (item === undefined) return null;

  const step = (delta: number) => {
    onIndexChange((index + delta + items.length) % items.length);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={labels.counter(index + 1, items.length)}
      hideTitle
      closeLabel={labels.close}
      size="wide"
      className="bg-transparent"
      backdropClassName="bg-scrim-strong"
    >
      <figure className="m-0 flex flex-col items-center gap-5">
        <img
          src={item.src}
          alt={item.alt}
          className="max-h-[76vh] w-auto rounded-media object-contain"
        />
        <figcaption className="flex flex-col items-center gap-2 text-center">
          {item.caption !== undefined && (
            <span className="text-body font-light text-dark-on">{item.caption}</span>
          )}
          {/* Polite, and announced on every step, so a screen reader user knows where in the
              set they are. Sighted users get the same number visually. */}
          <span aria-live="polite" className="font-bold uppercase text-label text-muted">
            {labels.counter(index + 1, items.length)}
          </span>
        </figcaption>
      </figure>

      {items.length > 1 && (
        <>
          <ArrowButton
            side="left"
            label={labels.previous}
            onClick={() => {
              step(-1);
            }}
          />
          <ArrowButton
            side="right"
            label={labels.next}
            onClick={() => {
              step(1);
            }}
          />
        </>
      )}
    </Modal>
  );
}

interface ArrowButtonProps {
  side: 'left' | 'right';
  label: string;
  onClick: () => void;
}

function ArrowButton({ side, label, onClick }: ArrowButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'absolute top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full',
        'border border-line bg-scrim text-dark-on transition-colors duration-colour',
        'hover:bg-accent hover:text-accent-on',
        side === 'left' ? 'left-4' : 'right-4',
      )}
    >
      {/* The arrows do exist in Stolzl — unlike the stars and ticks — so they stay as text. */}
      <span aria-hidden="true" className="text-lead">
        {side === 'left' ? '←' : '→'}
      </span>
    </button>
  );
}
