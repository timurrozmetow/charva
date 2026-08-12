import { type ReactNode, useCallback, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '../cn';
import { useFocusTrap, useScrollLock } from '../hooks/useFocusTrap';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** The dialog's accessible name. Rendered unless `hideTitle`. */
  title: ReactNode;
  hideTitle?: boolean;
  children?: ReactNode;
  /** Accessible name of the close button — translated by the caller. */
  closeLabel: string;
  /** `wide` is the lightbox, which wants the whole viewport. */
  size?: 'default' | 'wide';
  className?: string;
  /** Class for the backdrop, so the lightbox can darken further than a dialog does. */
  backdropClassName?: string;
}

/**
 * A modal dialog.
 *
 * There is no overlay of any kind in the handoff — every gallery tile and every video card is
 * an `<a href="#">` — so all of this is invented. It follows the ARIA dialog practices rather
 * than being improvised: the page behind is inert to assistive technology through
 * `aria-modal`, Tab is trapped, Escape closes, the page does not scroll underneath, and focus
 * returns to whatever opened it.
 *
 * Rendered through a portal on `document.body`. A dialog nested inside the page is subject to
 * every ancestor's `overflow`, `transform` and stacking context — and this design has a sticky
 * navigation island with a `backdrop-filter`, which creates one.
 */
export function Modal({
  open,
  onClose,
  title,
  hideTitle = false,
  children,
  closeLabel,
  size = 'default',
  className,
  backdropClassName,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Stable across renders so the trap does not tear down and re-run on every parent update,
  // which would steal focus back to the first control mid-interaction.
  const handleEscape = useCallback(() => {
    onClose();
  }, [onClose]);

  useFocusTrap(dialogRef, { active: open, onEscape: handleEscape });
  useScrollLock(open);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto p-6 mob:p-3">
      {/*
        The backdrop is its own element rather than a handler on the wrapper, so a click inside
        the dialog simply never reaches it and no `stopPropagation` is needed.

        Click-to-close here is a pointer convenience layered on the two real affordances —
        Escape and the close button — and the element is hidden from assistive technology, so
        the keyboard rules below have nothing to attach to.
      */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn('absolute inset-0 bg-scrim-strong', backdropClassName)}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative w-full rounded-panel bg-surface',
          size === 'wide' ? 'max-w-[1200px]' : 'max-w-[560px]',
          className,
        )}
      >
        <h2
          id={titleId}
          className={cn('m-0 px-11 pt-10 text-h3 font-medium text-ink', hideTitle && 'sr-only')}
        >
          {title}
        </h2>

        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full border border-line text-ink transition-colors duration-colour hover:bg-line-soft"
        >
          {/* Drawn from two bars rather than typed as ×, which is a multiplication sign that
              some faces do not carry and every face draws at a different weight. */}
          <span aria-hidden="true" className="relative block h-4 w-4">
            <span className="absolute left-0 top-1/2 h-[1.5px] w-4 -translate-y-1/2 rotate-45 rounded-full bg-current" />
            <span className="absolute left-0 top-1/2 h-[1.5px] w-4 -translate-y-1/2 -rotate-45 rounded-full bg-current" />
          </span>
        </button>

        {children}
      </div>
    </div>,
    document.body,
  );
}
