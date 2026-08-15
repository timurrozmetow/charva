import { type AdminUser, type Capability } from '@charva/contracts';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  login as callLogin,
  logout as callLogout,
  refreshSession,
  setAccessToken,
  setSessionLostHandler,
} from '../api/client';

/**
 * Who is signed in, for as long as the tab is open.
 *
 * Nothing is persisted. On load the provider asks the server to exchange the refresh cookie for
 * a token, which is what makes a reload keep the session without a single byte of it living
 * anywhere a script can read. If that exchange fails there is no session and the login screen
 * appears — the same path a first visit takes.
 *
 * The token is renewed a minute before it expires rather than after a request has already
 * failed, because the request that would have failed is the one carrying somebody's unsaved
 * form.
 */

export type SessionState = 'starting' | 'anonymous' | 'signed-in';

interface SessionValue {
  state: SessionState;
  user: AdminUser | null;
  can: (capability: Capability) => boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

/** Renewed this long before expiry. A minute is enough for a slow connection to finish. */
const RENEW_MARGIN_SECONDS = 60;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>('starting');
  const [user, setUser] = useState<AdminUser | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  const clearTimer = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const scheduleRenewal = useCallback(
    (expiresInSeconds: number) => {
      clearTimer();
      const delay = Math.max(5, expiresInSeconds - RENEW_MARGIN_SECONDS) * 1000;

      timer.current = setTimeout(() => {
        refreshSession()
          .then((session) => {
            setUser(session.user);
            scheduleRenewal(session.expiresInSeconds);
          })
          .catch(() => {
            // The session is genuinely over — rotated elsewhere, revoked, or expired.
            setAccessToken(null);
            setUser(null);
            setState('anonymous');
          });
      }, delay);
    },
    [clearTimer],
  );

  useEffect(() => {
    let cancelled = false;

    refreshSession()
      .then((session) => {
        if (cancelled) return;
        setUser(session.user);
        setState('signed-in');
        scheduleRenewal(session.expiresInSeconds);
      })
      .catch(() => {
        if (!cancelled) setState('anonymous');
      });

    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [clearTimer, scheduleRenewal]);

  useEffect(() => {
    setSessionLostHandler(() => {
      setUser(null);
      setState('anonymous');
    });
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      state,
      user,
      can: (capability) => user?.capabilities.includes(capability) ?? false,
      signIn: async (email, password) => {
        const session = await callLogin(email, password);
        setUser(session.user);
        setState('signed-in');
        scheduleRenewal(session.expiresInSeconds);
      },
      signOut: async () => {
        clearTimer();
        await callLogout();
        setUser(null);
        setState('anonymous');
        // Otherwise the next person to sign in on this machine sees the previous one's lists
        // for as long as the cache considers them fresh.
        queryClient.clear();
      },
    }),
    [state, user, scheduleRenewal, clearTimer, queryClient],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (value === null) throw new Error('useSession() used outside SessionProvider');
  return value;
}
