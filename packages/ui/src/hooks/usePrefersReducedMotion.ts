import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Whether the visitor has asked for less movement.
 *
 * The stylesheet already suppresses transitions and animations under this preference, but that
 * is not enough on its own: a carousel whose transition has been suppressed still advances,
 * so the content changes under the reader instantly and repeatedly instead of sliding. What
 * has to stop is the timer, and only JavaScript can stop a timer.
 *
 * Defaults to false rather than reading the query during render, so the first server-rendered
 * or hydrated pass matches on both sides.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(QUERY);
    setReduced(media.matches);

    const onChange = (event: MediaQueryListEvent) => {
      setReduced(event.matches);
    };
    media.addEventListener('change', onChange);
    return () => {
      media.removeEventListener('change', onChange);
    };
  }, []);

  return reduced;
}
