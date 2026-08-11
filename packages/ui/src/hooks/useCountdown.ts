import { useEffect, useState } from 'react';

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Milliseconds left, clamped at zero. */
  remainingMs: number;
  /** True once the target is in the past. */
  hasPassed: boolean;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function splitDuration(remainingMs: number): Countdown {
  const ms = Math.max(0, remainingMs);
  return {
    // Math.floor throughout. The prototypes use floor on the Umrah clock and ceil on both
    // Choice and the signup badge, so the same departure renders as 38 days on one page and
    // 39 on another. One function, one rounding rule.
    days: Math.floor(ms / DAY),
    hours: Math.floor(ms / HOUR) % 24,
    minutes: Math.floor(ms / MINUTE) % 60,
    seconds: Math.floor(ms / SECOND) % 60,
    remainingMs: ms,
    hasPassed: ms <= 0,
  };
}

export interface UseCountdownOptions {
  /** How often to re-read the clock. 1000 for a ticking clock, 30000 for a bare day count. */
  intervalMs?: number;
  /**
   * Stop ticking while the tab is hidden.
   *
   * A background tab that keeps a one-second interval alive for hours costs battery and buys
   * nothing: the value is recomputed from the wall clock on the way back, so it is correct the
   * moment the tab is visible again rather than having been correct the whole time nobody
   * was looking.
   */
  pauseWhenHidden?: boolean;
}

/**
 * Counts down to an instant.
 *
 * `target` is an absolute instant — an ISO string from the API, never a duration computed on
 * the client. The whole Umrah site currently hardcodes `2026-09-18T06:00:00Z` in three files
 * and the formatted date in eight more; this takes it from `umrah_trips` instead.
 */
export function useCountdown(
  target: Date | string | number,
  { intervalMs = 1000, pauseWhenHidden = true }: UseCountdownOptions = {},
): Countdown {
  const targetMs =
    target instanceof Date
      ? target.getTime()
      : typeof target === 'number'
        ? target
        : new Date(target).getTime();

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // The signup page in the prototypes computes its day count inline during render with no
    // timer at all, so the badge is frozen at whatever it said when the tab was opened.
    let timer: ReturnType<typeof setInterval> | undefined;

    const start = () => {
      setNow(Date.now());
      timer ??= setInterval(() => {
        setNow(Date.now());
      }, intervalMs);
    };

    const stop = () => {
      if (timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stop();
      else start();
    };

    start();
    if (pauseWhenHidden) document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      if (pauseWhenHidden) document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs, pauseWhenHidden]);

  return splitDuration(Number.isNaN(targetMs) ? 0 : targetMs - now);
}

/**
 * Just the number of whole days left.
 *
 * Choice and the Umrah signup badge only ever show this, and re-reading the clock every second
 * to render a number that changes once a day is waste.
 */
export function useDaysUntil(target: Date | string | number): number {
  return useCountdown(target, { intervalMs: 30_000 }).days;
}
