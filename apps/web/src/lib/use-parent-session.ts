'use client';

/**
 * Parent session — math-gate-bound, session-scoped access flag for /parent/*.
 *
 * Why sessionStorage (not localStorage):
 *  - Closing the tab clears it. A parent passing the gate doesn't grant the
 *    child later access from the same device.
 *  - 30-minute hard cap on top, defence in depth, so an unlocked tab left
 *    open mid-afternoon doesn't stay unlocked forever.
 *
 * The math-gate UI lives at the consumer (parent layout). This hook just
 * persists / reads / clears the flag and exposes the React context for child
 * routes to share state.
 */

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const SESSION_KEY = 'e4k.parentSession';
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface SessionRecord {
  passedAt: number;
}

export interface ParentSessionValue {
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

export const ParentSessionContext = createContext<ParentSessionValue | null>(null);

function readSession(): SessionRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionRecord;
    if (typeof parsed.passedAt !== 'number') return null;
    if (Date.now() - parsed.passedAt > SESSION_TTL_MS) {
      window.sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(record: SessionRecord): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(record));
  } catch {
    // sessionStorage may be unavailable (private mode); the gate will simply
    // re-prompt on next navigation.
  }
}

function clearSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

/**
 * Internal hook that powers the ParentSessionContext provider in the parent
 * layout. Components that need session state should call `useParentSession()`
 * which reads the context.
 */
export function useParentSessionState(): ParentSessionValue {
  const [authed, setAuthed] = useState<boolean>(false);

  // Re-evaluate session on mount + every 60s so we expire reliably even if the
  // tab sits idle.
  useEffect(() => {
    const sync = (): void => {
      const rec = readSession();
      setAuthed(rec !== null);
    };
    sync();
    const interval = window.setInterval(sync, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const login = useCallback(() => {
    writeSession({ passedAt: Date.now() });
    setAuthed(true);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setAuthed(false);
  }, []);

  return { isAuthenticated: authed, login, logout };
}

/**
 * Hook for child routes to read the parent-session state from the
 * ParentSessionContext provided by the parent layout. Throws if used outside
 * the provider so misuse fails loudly during development.
 */
export function useParentSession(): ParentSessionValue {
  const ctx = useContext(ParentSessionContext);
  if (!ctx) {
    throw new Error('useParentSession must be used within a ParentSessionContext provider');
  }
  return ctx;
}

export const PARENT_SESSION_TTL_MS = SESSION_TTL_MS;
export const PARENT_SESSION_KEY = SESSION_KEY;
