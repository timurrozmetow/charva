import { type ReactNode, useEffect, useRef, useState } from 'react';

export interface DeferredProps {
  /**
   * Rendered once the placeholder comes within `rootMargin` of the viewport. Nothing inside is
   * rendered before that, so a `lazy()` component here does not fetch its chunk until then.
   */
  children: ReactNode;
  /**
   * Stands in until then, and must be the same height as what replaces it. Not optional: a zero
   * height placeholder pulls everything below it up and then pushes it back down.
   */
  fallback: ReactNode;
  /**
   * How far ahead to start. 600px is roughly two thumb-flicks on a phone, which on the slow
   * connections this site is built for is enough time for a chunk to arrive before the reader
   * does — the point being that nobody should ever see the fallback.
   */
  rootMargin?: string;
  className?: string;
}

/**
 * Holds a heavy subtree out of the page until the reader is on their way to it.
 *
 * Written for one measured case and general because there will be others. The lead form is 99 KB
 * before compression — 53 of Zod and 33 of react-hook-form, against 5 of form — and it sits at
 * the bottom of both homepages, of the tour page and of the hotel page. Every visitor downloaded
 * all of it while looking at the photograph at the top, on the same connection the photograph
 * was using, whether or not they ever scrolled that far.
 *
 * It is deliberately not `loading="lazy"` in spirit: that defers *bytes of an element already in
 * the layout*, whereas this defers the element. The distinction matters for the fallback, which
 * has to hold the space itself or the deferral buys speed and pays for it in layout shift.
 *
 * `IntersectionObserver` is in every browser this site supports, and the effect runs only in the
 * browser — but a server render or a test environment without one must still show something, so
 * the absence of the constructor means «render it now» rather than «render it never». That is the
 * safe direction: the failure mode of guessing wrong is a slower page, not a missing one.
 */
export function Deferred({ children, fallback, rootMargin = '600px', className }: DeferredProps) {
  const [near, setNear] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (near) return;

    if (typeof IntersectionObserver !== 'function') {
      setNear(true);
      return;
    }

    const element = anchor.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true);
      },
      { rootMargin },
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [near, rootMargin]);

  /*
   * The wrapper stays after the swap rather than being replaced by a fragment.
   *
   * Two reasons, and the second is the one that bites: a wrapper that disappears takes its own
   * box out of the grid it sits in, and both homepages put this in a two-column grid where that
   * would re-flow the column beside it. Keeping it means what the reader sees appear is the
   * content, not the layout.
   */
  return (
    <div ref={anchor} className={className}>
      {near ? children : fallback}
    </div>
  );
}
