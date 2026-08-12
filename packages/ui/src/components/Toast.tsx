import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '../cn';

export type ToastTone = 'success' | 'error';

export interface ToastItem {
  id: string;
  tone: ToastTone;
  message: ReactNode;
}

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
    setToasts((current) => current.filter((toast) => toast.id !== id));
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
          <div
            key={toast.id}
            className={cn(
              'flex items-start gap-4 rounded-panel-sm border px-5 py-4 shadow-card',
              'animate-drop-in text-bodySm font-medium',
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
              className="shrink-0 text-muted transition-colors duration-colour hover:text-ink"
            >
              <span aria-hidden="true" className="relative block h-3 w-3">
                <span className="absolute left-0 top-1/2 h-[1.5px] w-3 -translate-y-1/2 rotate-45 rounded-full bg-current" />
                <span className="absolute left-0 top-1/2 h-[1.5px] w-3 -translate-y-1/2 -rotate-45 rounded-full bg-current" />
              </span>
            </button>
          </div>
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
