import { useEffect, useState } from 'react';

import { cn } from '../cn';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

export interface TopProgressProps {
  /** True while anything is in flight — a navigation, a query, a save. */
  active: boolean;
  className?: string;
}

/** Below this, a request finished before anybody could perceive it had started. */
const APPEAR_AFTER_MS = 140;

/** How far the bar creeps while it waits. Never 100: the work is not done. */
const CEILING = 92;

/**
 * The hairline at the top of the window that says the site is doing something.
 *
 * A page that has been visited before answers from the query cache and never shows a skeleton,
 * so between the click and the new page there was nothing at all. On a slow connection that
 * reads as a click that did not register, and people click again. This is the smallest thing
 * that fixes it: two pixels of accent, above everything, that nobody has to look at.
 *
 * It stays away for the first {@link APPEAR_AFTER_MS} milliseconds. Most navigations here are
 * cache hits that finish inside that window, and a bar which flashes on every click is worse
 * than no bar — it draws the eye to the one place where nothing is happening.
 *
 * The creep is deliberately not a percentage of anything. Nothing knows how long a request will
 * take and a bar that claims to is lying; this one eases toward {@link CEILING} and completes
 * only when the work actually does.
 *
 * No `role="progressbar"`: `QueryState` already announces «Загружаем» once, politely, and a
 * second announcement on every navigation is noise a screen-reader user cannot dismiss. This is
 * for the eye, so it says so and stays out of the tree.
 */
export function TopProgress({ active, className }: TopProgressProps) {
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const still = usePrefersReducedMotion();

  useEffect(() => {
    if (still) {
      /*
       * No creep, and no timer left running behind a suppressed transition.
       *
       * The global stylesheet flattens every transition to nothing, which would leave the creep
       * stepping the bar in jerks — motion is the whole content of this control, so when motion
       * is unwelcome the bar states the fact instead of animating it: present while busy, gone
       * when not.
       */
      setVisible(active);
      setWidth(active ? 100 : 0);
      return;
    }

    if (active) {
      const appear = setTimeout(() => {
        setVisible(true);
        setWidth(12);
      }, APPEAR_AFTER_MS);

      // Each step covers a fraction of what is left, so it slows as it goes and never arrives —
      // the honest shape for a wait of unknown length.
      const creep = setInterval(() => {
        setWidth((current) => (current === 0 ? 0 : current + (CEILING - current) * 0.18));
      }, 260);

      return () => {
        clearTimeout(appear);
        clearInterval(creep);
      };
    }

    // A width of zero means the request beat the delay and nothing was ever drawn, which is the
    // common case; there is no completion to show for a bar nobody saw.
    setWidth((current) => (current === 0 ? 0 : 100));

    const hide = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 260);

    return () => {
      clearTimeout(hide);
    };
  }, [active, still]);

  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-[200] h-[2px]',
        'transition-opacity duration-200',
        visible ? 'opacity-100' : 'opacity-0',
        className,
      )}
    >
      <div
        className="h-full bg-accent transition-[width] duration-300 ease-out"
        style={{ width: `${String(width)}%` }}
      />
    </div>
  );
}
