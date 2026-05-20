'use client';

/**
 * /parent/* layout.
 *
 * Wraps every parent route in ParentGate (math gate). On pass, sets a
 * session-scoped flag (sessionStorage, NOT localStorage) so navigation
 * between /parent pages doesn't re-prompt unless the 30-minute TTL elapsed.
 * On every entry to a /parent route, if the flag is missing or expired we
 * re-prompt and bounce the parent back to /play if they dismiss.
 *
 * --- Analytics policy (Sprint 5 S5-5) ---
 * Parent routes are the ONLY routes allowed to load Plausible (cookieless,
 * EU-hosted). Child pages stay tracker-free. We mount `<PlausibleScript />`
 * at the TOP of this layout so it loads on the math gate itself (parent
 * traffic still gets counted even if they bounce off without solving),
 * but ONLY for `/parent/*` URLs.
 *
 * The script tag is conditional on `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` being set
 * — until the user creates a Plausible account and wires the domain in
 * `.env.example`, nothing actually loads. The E2E spec
 * `tests/e2e/plausible-child-isolation.spec.ts` guarantees that no
 * `plausible.io` request ever escapes a child-facing route.
 */

import { PlausibleScript } from '@/components/PlausibleScript';
import {
  ParentSessionContext,
  type ParentSessionValue,
  useParentSessionState,
} from '@/lib/use-parent-session';
import { db } from '@e4k/db';
import { ParentGate } from '@e4k/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useState } from 'react';

interface ParentLayoutProps {
  children: ReactNode;
}

async function logAudit(eventType: string): Promise<void> {
  try {
    await db.auditLog.add({
      actor_id: null,
      child_id: null,
      event_type: eventType,
      payload: {},
      occurred_at: new Date().toISOString(),
    } as never);
  } catch {
    // Dexie can fail in private mode; audit logging is best-effort.
  }
}

export default function ParentLayout({ children }: ParentLayoutProps) {
  const router = useRouter();
  const t = useTranslations();
  const session = useParentSessionState();
  const [gateOpen, setGateOpen] = useState<boolean>(false);
  const [checkedInitial, setCheckedInitial] = useState<boolean>(false);

  // On mount: if not authenticated, open the gate. We wait one tick so the
  // session hook can hydrate from sessionStorage first.
  useEffect(() => {
    if (checkedInitial) return;
    const tid = window.setTimeout(() => {
      setCheckedInitial(true);
      if (!session.isAuthenticated) {
        setGateOpen(true);
      }
    }, 0);
    return () => window.clearTimeout(tid);
  }, [checkedInitial, session.isAuthenticated]);

  // If TTL expires while the parent is on a page, re-prompt.
  useEffect(() => {
    if (!checkedInitial) return;
    if (!session.isAuthenticated && !gateOpen) {
      setGateOpen(true);
    }
  }, [session.isAuthenticated, checkedInitial, gateOpen]);

  const handleGateOpenChange = useCallback(
    (open: boolean): void => {
      setGateOpen(open);
      // If they dismiss the gate without passing, route back to /play. We
      // never strand the parent on a blank screen.
      if (!open && !session.isAuthenticated) {
        router.push('/play');
      }
    },
    [router, session.isAuthenticated],
  );

  const handleGatePass = useCallback((): void => {
    session.login();
    void logAudit('parent_dashboard_opened');
    setGateOpen(false);
  }, [session]);

  const handleLogout = useCallback((): void => {
    session.logout();
    void logAudit('parent_dashboard_closed');
    router.push('/play');
  }, [router, session]);

  const handleBackToApp = useCallback((): void => {
    router.push('/play');
  }, [router]);

  const ctxValue: ParentSessionValue = {
    isAuthenticated: session.isAuthenticated,
    login: session.login,
    logout: handleLogout,
  };

  return (
    <ParentSessionContext.Provider value={ctxValue}>
      {/*
        Plausible loads here so the math gate itself is counted as parent
        traffic. The script only renders when NEXT_PUBLIC_PLAUSIBLE_DOMAIN
        is set; otherwise PlausibleScript returns null and nothing ships.
      */}
      <PlausibleScript />
      <div className="flex min-h-dvh flex-col bg-[var(--color-surface)]">
        <header
          role="banner"
          className="flex w-full items-center justify-between gap-[var(--space-3)] bg-[var(--color-surface-high)] px-[var(--space-4)] py-[var(--space-3)] shadow-[var(--shadow-card)]"
        >
          <button
            type="button"
            onClick={handleBackToApp}
            aria-label={t('parent.backToAppAria')}
            className="flex items-center justify-center rounded-[var(--radius-pill)] bg-transparent px-[var(--space-3)] text-[var(--color-primary-dark)] transition-transform duration-[var(--motion-fast)] active:scale-95"
            style={{ minHeight: '48px', fontFamily: 'var(--font-display)' }}
          >
            {t('common.backToApp')}
          </button>
          <h1
            className="flex-1 truncate px-[var(--space-3)] text-center text-xl text-[var(--color-ink)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t('parent.title')}
          </h1>
          {session.isAuthenticated ? (
            <button
              type="button"
              onClick={handleLogout}
              aria-label={t('parent.lockAria')}
              className="flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-surface)] px-[var(--space-3)] text-[var(--color-ink)] transition-transform duration-[var(--motion-fast)] active:scale-95"
              style={{ minHeight: '48px', fontFamily: 'var(--font-display)' }}
            >
              {t('parent.lock')}
            </button>
          ) : (
            <span className="h-12 w-20" aria-hidden="true" />
          )}
        </header>

        {session.isAuthenticated ? (
          <div className="flex flex-1 flex-col">{children}</div>
        ) : (
          <p
            aria-live="polite"
            className="flex flex-1 items-center justify-center px-[var(--space-6)] text-center text-lg text-[var(--color-ink)]"
          >
            {t('common.verifyingGrownUp')}
          </p>
        )}

        <ParentGate
          open={gateOpen}
          onOpenChange={handleGateOpenChange}
          onPass={handleGatePass}
          title={t('gate.title')}
          description={t('gate.descriptionOpenDashboard')}
        />
      </div>
    </ParentSessionContext.Provider>
  );
}
