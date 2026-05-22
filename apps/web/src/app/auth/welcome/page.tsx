'use client';

/**
 * Sprint 7 — Auth welcome screen.
 *
 * First impression: big Milo + three CTAs. "Sign in" and "Create account"
 * are large pill buttons; "Continue as guest" is a small text link at the
 * bottom (standard app UX). An AgeGate fires on the sign-in/sign-up paths
 * before the user reaches the actual forms.
 */

import { setSetting } from '@e4k/db';
import { AgeGate, MascotPanel, PrimaryButton } from '@e4k/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/use-auth';

type GateTarget = 'sign-in' | 'sign-up' | null;

export default function AuthWelcomePage() {
  const t = useTranslations();
  const router = useRouter();
  const { continueAsGuest } = useAuth();
  const [gateOpen, setGateOpen] = useState(false);
  const [gateTarget, setGateTarget] = useState<GateTarget>(null);
  const [busy, setBusy] = useState(false);

  const openGate = (target: Exclude<GateTarget, null>) => {
    setGateTarget(target);
    setGateOpen(true);
  };

  const onAdult = () => {
    if (gateTarget === 'sign-in') router.push('/auth/sign-in');
    else if (gateTarget === 'sign-up') router.push('/auth/sign-up');
  };

  const onParentVerified = () => {
    // Parent verified for an under-13 child: route to sign-up so the
    // parent can create the account.
    router.push('/auth/sign-up');
  };

  const onGuest = async () => {
    setBusy(true);
    try {
      await continueAsGuest();
    } catch {
      // Anonymous sign-in unsupported (older Supabase) — fall back to the
      // existing in-app anonymous-first flow which doesn't require a
      // session.
    } finally {
      // Persist the choice so the home gate doesn't bounce them back to
      // /auth/welcome on every reload.
      try {
        await setSetting('auth.skipped', true);
      } catch {
        // Dexie unavailable (private mode) — accept the bounce.
      }
      setBusy(false);
      router.replace('/');
    }
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-between bg-[var(--color-surface)] px-[var(--space-6)] py-[var(--space-10)]">
      <div className="flex w-full max-w-[480px] flex-1 flex-col items-center justify-center gap-[var(--space-6)]">
        <MascotPanel
          variant="milo"
          state="welcoming"
          speech={t('auth.welcome.title')}
          heightCss="260px"
        />
        <p
          className="text-center text-base text-[var(--color-mist)]"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {t('auth.welcome.subtitle')}
        </p>
        <div className="flex w-full flex-col gap-[var(--space-3)]">
          <PrimaryButton
            tone="primary"
            fullWidth
            size="lg"
            onClick={() => openGate('sign-in')}
          >
            {t('auth.welcome.signIn')}
          </PrimaryButton>
          <PrimaryButton
            tone="milo"
            fullWidth
            size="lg"
            onClick={() => openGate('sign-up')}
          >
            {t('auth.welcome.createAccount')}
          </PrimaryButton>
        </div>
      </div>
      <div className="mt-[var(--space-6)] flex flex-col items-center gap-[var(--space-1)]">
        <button
          type="button"
          onClick={onGuest}
          disabled={busy}
          className="text-sm text-[var(--color-primary)] underline"
        >
          {t('auth.welcome.guest')}
        </button>
        <span className="text-xs text-[var(--color-mist)]">{t('auth.welcome.guestHint')}</span>
      </div>
      <AgeGate
        open={gateOpen}
        onOpenChange={setGateOpen}
        onAdult={onAdult}
        onParentVerified={onParentVerified}
        onChildStaysAnonymous={onGuest}
        copy={{
          title: t('auth.ageGate.title'),
          description: t('auth.ageGate.description'),
          yes: t('auth.ageGate.yes'),
          no: t('auth.ageGate.no'),
          parentTitle: t('auth.ageGate.parentTitle'),
          parentDescription: t('auth.ageGate.parentDescription'),
        }}
      />
    </main>
  );
}
