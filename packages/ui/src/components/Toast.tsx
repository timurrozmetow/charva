import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '../cn';
import { duration } from '../tokens';

export type ToastTone = 'success' | 'error';

export interface ToastItem {
  id: string;
  tone: ToastTone;
  message: ReactNode;
  /**
   * Dismissed, but still on screen while it leaves.
   *
   * The row stays mounted for `EXIT_MS` after a dismissal so it has something to animate out
   * with. Nothing outside this module needs to look at it — the viewport reads it, and the
   * message is already gone from the reader's point of view.
   */
  leaving?: boolean;
}

/**
 * How long a dismissed toast stays mounted so it can leave.
 *
 * Derived from the transition it has to outlast rather than written beside it. Two hand-typed
 * numbers where one has to be larger than the other stay right until somebody adjusts the one
 * they can see, and the failure is invisible in code and barely visible on screen: the row is
 * unmounted mid-fade, so the toast disappears at whatever opacity it had reached.
 */
const EXIT_MS = duration.drop + 40;

const TONE: Record<ToastTone, string> = {
  // No green anywhere in this design; the accent is what "it worked" looks like on both sites.
  success: 'border-tint-line bg-surface text-ink',
  error: 'border-danger bg-surface text-danger',
};

export interface UseToastsResult {
  toasts: readonly ToastItem[];
  /** Returns the id, so a caller can dismiss its own toast early. */
  push: (tone: ToastTone, message: ReactNode) => string;
  dismiss: (id: string) => void;
}

/**
 * Transient messages.
 *
 * Each one clears itself after `timeoutMs`, and the timers are cleared on unmount — a toast
 * queued as the user navigates away otherwise keeps a timer alive against a component that no
 * longer exists.
 *
 * A dismissal is two steps, because it used to be one. `dismiss` filtered the toast straight out
 * of the array, so a message that had arrived with a 260ms animation vanished between two
 * frames — the one motion in the pair that a reader might actually need, since a thing leaving
 * on its own is the case where they have to notice it left. It is now marked `leaving`, the row
 * animates, and it is removed `EXIT_MS` later.
 */
export function useToasts(timeoutMs = 6000): UseToastsResult {
  const [toasts, setToasts] = useState<readonly ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }

    // Keyed on `${id}:exit` in the same map, so the unmount cleanup below sweeps it too: an exit
    // timer outliving its component is the same leak the timeout already guarded against.
    const exitKey = `${id}:exit`;
    if (timers.current.has(exitKey)) return;

    setToasts((current) =>
      current.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)),
    );

    timers.current.set(
      exitKey,
      setTimeout(() => {
        timers.current.delete(exitKey);
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, EXIT_MS),
    );
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: ReactNode) => {
      counter.current += 1;
      const id = `toast-${String(counter.current)}`;
      setToasts((current) => [...current, { id, tone, message }]);
      timers.current.set(
        id,
        setTimeout(() => {
          dismiss(id);
        }, timeoutMs),
      );
      return id;
    },
    [dismiss, timeoutMs],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  return { toasts, push, dismiss };
}

export interface ToastViewportProps {
  toasts: readonly ToastItem[];
  onDismiss: (id: string) => void;
  dismissLabel: string;
  className?: string;
}

/**
 * Where the toasts are drawn.
 *
 * Two live regions rather than one: a failure interrupts (`assertive`), a confirmation waits
 * for a pause (`polite`). A single region set to one or the other is wrong half the time.
 *
 * Mounted whether or not there is anything to show, because a live region inserted at the
 * moment it gains content is frequently not announced — the same reason `FormError` stays.
 */
export function ToastViewport({ toasts, onDismiss, dismissLabel, className }: ToastViewportProps) {
  const render = (tone: ToastTone, live: 'polite' | 'assertive') => (
    <div aria-live={live} className="flex flex-col gap-3">
      {toasts
        .filter((toast) => toast.tone === tone)
        .map((toast) => (
          <ToastRow
            key={toast.id}
            toast={toast}
            onDismiss={onDismiss}
            dismissLabel={dismissLabel}
          />
        ))}
    </div>
  );

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-[300] flex w-[360px] flex-col gap-3 mob:inset-x-3 mob:w-auto',
        className,
      )}
    >
      {render('error', 'assertive')}
      {render('success', 'polite')}
    </div>
  );
}

interface ToastRowProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
  dismissLabel: string;
}

/**
 * One toast, with an entrance and an exit — and both are transitions rather than keyframes.
 *
 * The difference is not cosmetic. A keyframe restarts from its first frame every time it is
 * applied, so a second toast arriving while the first is still moving makes the pair jump; a
 * transition retargets from wherever the element currently is. Toasts are the textbook case for
 * this because they are the one thing here that can be triggered twice in half a second — a
 * form that fails validation and is submitted again.
 *
 * The entrance needs a frame at the closed values before it can transition out of them, which
 * is what `open` is for. `requestAnimationFrame` rather than a bare `useEffect`: the effect runs
 * before the browser has painted, so flipping the class there gives it nothing to move from and
 * the toast appears fully formed.
 */
function ToastRow({ toast, onDismiss, dismissLabel }: ToastRowProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setOpen(true);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);

  const showing = open && toast.leaving !== true;

  return (
    <div
      // Not decoration: the tests assert against this rather than against a class name, and it
      // is what somebody debugging a stuck toast can see in devtools.
      data-state={toast.leaving === true ? 'leaving' : open ? 'open' : 'entering'}
      className={cn(
        'flex items-start gap-4 rounded-panel-sm border px-5 py-4 shadow-card',
        'text-bodySm font-medium',
        'transition-[opacity,transform] duration-drop ease-drop',
        // Out towards the corner it lives in, rather than up: the viewport is pinned bottom
        // right, so leaving to the right is leaving the way it came.
        showing ? 'translate-x-0 opacity-100' : 'translate-x-3 opacity-0',
        TONE[toast.tone],
      )}
    >
      <span className="flex-1">{toast.message}</span>
      <button
        type="button"
        aria-label={dismissLabel}
        onClick={() => {
          onDismiss(toast.id);
        }}
        className="shrink-0 text-muted transition-colors duration-press ease-press hover:text-ink"
      >
        <span aria-hidden="true" className="relative block h-3 w-3">
          <span className="absolute left-0 top-1/2 h-[1.5px] w-3 -translate-y-1/2 rotate-45 rounded-full bg-current" />
          <span className="absolute left-0 top-1/2 h-[1.5px] w-3 -translate-y-1/2 -rotate-45 rounded-full bg-current" />
        </span>
      </button>
    </div>
  );
}
