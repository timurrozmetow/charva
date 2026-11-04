import { type ElementType, type ReactNode, useLayoutEffect, useRef, useState } from 'react';

import { cn } from '../cn';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

export interface RevealProps {
  children: ReactNode;
  /**
   * Position in a row or grid, for the stagger.
   *
   * Each step adds 60ms, capped at five — a six-card row would otherwise finish half a second
   * after it started, by which time the reader has scrolled past the end of it.
   */
  index?: number;
  /** The element to render. A `<section>` or `<li>` usually reads better than a `<div>`. */
  as?: ElementType;
  className?: string;
}

/** 60ms a step, five steps at most. */
const STEP_MS = 60;
const MAX_STEPS = 5;

/**
 * A section arriving as the reader reaches it.
 *
 * The only motion on these sites that answers scrolling, and the one thing their long pages had
 * nothing of: every section of every page was simply there, the whole document complete before
 * the reader had read a line of it. Opacity and ten pixels, nothing more — this is pacing on a
 * brochure page, not an effect.
 *
 * **It starts visible, and that is the whole safety argument.** The hidden state is applied by
 * this effect, which means it is applied only where something is certainly going to remove it
 * again. No JavaScript, no `IntersectionObserver`, an exception on the way — in every one of
 * those the element has never been hidden and the reader sees the page. The failure mode of the
 * opposite arrangement is a blank page, and it is the standard way this pattern goes wrong.
 *
 * `useLayoutEffect` rather than `useEffect` so the hiding happens before the browser paints:
 * with `useEffect` the first frame shows the section at rest and the second snatches it away,
 * which is visible and looks like a bug.
 *
 * Reduced motion skips it entirely rather than shortening it. There is nothing here to
 * understand — no state change being explained, no position being established — so the gentler
 * variant of «a section fades up» is «a section».
 *
 * CSS rather than a motion library on purpose. This is a one-way transition on two composited
 * properties, so a CSS transition runs it off the main thread, which is the half of the frame
 * budget that is under pressure on a phone on a slow connection — the same argument D-150 and
 * D-159 make about image widths and precompression. A library would buy interruption and
 * springs, neither of which a scroll reveal has any use for, and cost about a fifth of the
 * bundle budget (D-145).
 */
export function Reveal({ children, index = 0, as: Tag = 'div', className }: RevealProps) {
  const [state, setState] = useState<'shown' | 'pending'>('shown');
  const anchor = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();

  useLayoutEffect(() => {
    /*
     * The preference is read here as well as through the hook, and that is not belt and braces.
     *
     * `usePrefersReducedMotion` returns false on the first render and corrects itself in an
     * effect, because it is written so a hydrated pass matches the server's. That is one paint
     * too late for a decision about *hiding* something: this effect would hide the section,
     * then run again with the true value and — returning early — leave it hidden for good. The
     * reader who asked for less movement would be the only one who could not read the page.
     *
     * Caught by `Reveal.dom.test.tsx`, which is why that file is mostly about the paths where
     * nothing should be hidden.
     */
    const prefersLess =
      reduced ||
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    if (prefersLess) {
      // `setState` rather than `return`: a preference turned on mid-session has to put back
      // whatever an earlier run of this effect took away.
      setState('shown');
      return;
    }

    if (typeof IntersectionObserver !== 'function') return;

    const element = anchor.current;
    if (!element) return;

    /*
     * Already in view at mount — above the fold — stays as it is.
     *
     * Hiding it would mean the first thing a visitor sees is a page fading itself in, which is
     * the loading screen's job (D-125) and not this one's. `getBoundingClientRect` rather than
     * waiting for the observer's first callback, because that callback arrives after a paint.
     */
    const box = element.getBoundingClientRect();
    const viewport = window.innerHeight || document.documentElement.clientHeight;
    if (box.top < viewport) return;

    setState('pending');

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setState('shown');
        observer.disconnect();
      },
      // A little before the edge, so the section is at rest by the time it is properly readable
      // rather than finishing its movement under the reader's eye.
      { rootMargin: '0px 0px -10% 0px' },
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [reduced]);

  const delay = Math.min(index, MAX_STEPS) * STEP_MS;

  return (
    <Tag
      ref={anchor}
      data-reveal={state}
      // The delay belongs to the arrival, not to the hiding: leaving it on the hidden state
      // would stagger the disappearance too, and the disappearance is never seen.
      style={
        state === 'pending' || delay === 0 ? undefined : { transitionDelay: `${String(delay)}ms` }
      }
      className={cn(
        'transition-[opacity,transform] duration-reveal ease-press',
        'data-[reveal=pending]:translate-y-2.5 data-[reveal=pending]:opacity-0',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
