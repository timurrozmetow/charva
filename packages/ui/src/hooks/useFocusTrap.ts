import { type RefObject, useEffect } from 'react';

/**
 * What counts as focusable, in document order.
 *
 * `:not([tabindex="-1"])` matters: the carousel and the tab list both park elements at -1
 * deliberately, and pulling them back into a trap would undo that.
 */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function focusableWithin(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    // `offsetParent` is null for anything `display: none`, which is how a closed accordion
    // panel or a hidden slide would otherwise sneak into the cycle.
    (element) => element.offsetParent !== null || element === document.activeElement,
  );
}

export interface FocusTrapOptions {
  /** Nothing happens while this is false, so the hook can sit in a component that is closed. */
  active: boolean;
  onEscape?: (() => void) | undefined;
}

/**
 * Keeps Tab inside a container while it is open, and puts focus back where it came from.
 *
 * All three of these are things the prototypes have no occasion to get wrong, because they
 * contain no overlay at all — every gallery tile, every video card and every "read more" is an
 * `<a href="#">`. They are also the three things overlays get wrong most often:
 *
 * - focus is moved into the dialog when it opens, so a screen reader is not left reading the
 *   page underneath;
 * - Tab and Shift+Tab wrap at the ends instead of walking out into the page behind;
 * - focus returns to the element that opened it, so closing a lightbox from the eleventh tile
 *   does not drop the user back at the top of the page.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement>,
  { active, onEscape }: FocusTrapOptions,
): void {
  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (container === null) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus the first thing inside, or the container itself if there is nothing — a lightbox
    // showing one photograph and a close button still has the button, but a confirmation with
    // no controls at all must not leave focus on the page behind.
    const initial = focusableWithin(container)[0] ?? container;
    initial.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onEscape?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = focusableWithin(container);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first === undefined || last === undefined) {
        event.preventDefault();
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      // `isConnected` guards the case where the opener itself was removed while the overlay
      // was up — focusing a detached node silently sends focus to <body>.
      if (previouslyFocused?.isConnected === true) previouslyFocused.focus();
    };
  }, [active, containerRef, onEscape]);
}

/**
 * Stops the page behind an overlay from scrolling.
 *
 * The padding compensation is not cosmetic: removing the scrollbar shifts every fixed element
 * on the page — the sticky navigation island above all — sideways by its width, and the jump
 * is plainly visible each time a lightbox opens.
 */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;

    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = 'hidden';
    if (scrollbar > 0) body.style.paddingRight = `${String(scrollbar)}px`;

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, [active]);
}
