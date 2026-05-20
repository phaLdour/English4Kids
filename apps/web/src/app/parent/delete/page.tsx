'use client';

/**
 * Destructive action — delete all data, with a 7-day grace period.
 *
 * Flow (cannot be skipped):
 *   1. Acknowledge the explanation by ticking "I understand".
 *   2. Type the word DELETE (case-sensitive) into a confirmation input.
 *   3. Pass the ParentGate math gate one more time.
 *
 * On confirm we DO NOT delete anything immediately. We write a single
 * scheduled-deletion record (`parent.deletion.scheduledFor`) to Dexie's
 * settings table with a timestamp 7 days in the future. A boot-time hook in
 * providers.tsx (owned by sister subagent) will read that record on each
 * launch and perform the real wipe if its time has elapsed.
 *
 * Until then the parent can return to this page and cancel the scheduled
 * deletion — that's the entire point of the grace period.
 *
 * Copy red line: we use --color-alert (not blood red) and avoid threatening
 * language. "Delete all data. You can restore for 7 days." is the entire
 * promise.
 */

import { getSetting, setSetting } from '@e4k/db';
import { ParentGate } from '@e4k/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

const GRACE_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const CONFIRM_WORD = 'DELETE';

type Step = 'idle' | 'understood' | 'typed' | 'gating' | 'scheduled';

export default function DeleteAllDataPage() {
  const t = useTranslations();
  const [step, setStep] = useState<Step>('idle');
  const [understood, setUnderstood] = useState(false);
  const [typed, setTyped] = useState('');
  const [gateOpen, setGateOpen] = useState(false);
  const [scheduledFor, setScheduledFor] = useState<number | null>(null);
  const [announce, setAnnounce] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await getSetting<number | null>('parent.deletion.scheduledFor', null);
      if (!cancelled && stored) {
        setScheduledFor(stored);
        setStep('scheduled');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUnderstoodChange = useCallback((next: boolean) => {
    setUnderstood(next);
    if (next) setStep('understood');
    else setStep('idle');
  }, []);

  const typedMatches = typed === CONFIRM_WORD;

  const handleProceed = useCallback(() => {
    if (!understood || !typedMatches) return;
    setStep('gating');
    setGateOpen(true);
  }, [typedMatches, understood]);

  const handleGateOpenChange = useCallback(
    (open: boolean) => {
      setGateOpen(open);
      if (!open && step === 'gating') {
        // Cancelled — go back to the typed step so they can retry.
        setStep('typed');
      }
    },
    [step],
  );

  const finaliseSchedule = useCallback(async (): Promise<void> => {
    const target = Date.now() + GRACE_DAYS * MS_PER_DAY;
    try {
      await setSetting('parent.deletion.scheduledFor', target);
      setScheduledFor(target);
      setStep('scheduled');
      setAnnounce(t('parent.deleteAnnounceScheduled'));
    } catch {
      setAnnounce(t('parent.deleteAnnounceCouldNotSchedule'));
    }
  }, [t]);

  const handleGatePass = useCallback(() => {
    void finaliseSchedule();
  }, [finaliseSchedule]);

  const handleCancelSchedule = useCallback(async (): Promise<void> => {
    try {
      await setSetting('parent.deletion.scheduledFor', null);
      setScheduledFor(null);
      setStep('idle');
      setUnderstood(false);
      setTyped('');
      setAnnounce(t('parent.deleteAnnounceCancelled'));
    } catch {
      setAnnounce(t('parent.deleteAnnounceCouldNotCancel'));
    }
  }, [t]);

  useEffect(() => {
    if (understood && typedMatches && step !== 'gating' && step !== 'scheduled') {
      setStep('typed');
    }
  }, [understood, typedMatches, step]);

  return (
    <main
      data-testid="parent-delete"
      className="mx-auto flex w-full max-w-2xl flex-col gap-[var(--space-6)] px-[var(--space-4)] py-[var(--space-6)] pb-[var(--space-16)]"
    >
      <span aria-live="polite" className="sr-only">
        {announce}
      </span>

      <section
        aria-label={t('parent.deleteAreaAria')}
        className="flex flex-col gap-[var(--space-3)] rounded-[var(--radius-lg)] bg-[var(--color-surface-high)] p-[var(--space-6)] shadow-[var(--shadow-card)]"
        style={{ borderLeft: '6px solid var(--color-alert)' }}
      >
        <h1
          className="text-2xl text-[var(--color-primary-dark)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t('parent.deleteTitle')}
        </h1>
        <p className="text-base text-[var(--color-ink)]">
          {t('parent.deleteBody')}
        </p>
        <p className="text-sm text-[var(--color-mist)]">
          {t('parent.deleteFinal')}
        </p>
      </section>

      {step === 'scheduled' && scheduledFor !== null ? (
        <section
          aria-label={t('parent.deleteScheduledAria')}
          className="flex flex-col gap-[var(--space-3)] rounded-[var(--radius-lg)] bg-[var(--color-surface-high)] p-[var(--space-6)] shadow-[var(--shadow-card)]"
          style={{ borderLeft: '6px solid var(--color-alert)' }}
        >
          <h2
            className="text-xl text-[var(--color-primary-dark)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t('parent.deleteScheduledTitle')}
          </h2>
          <p className="text-base text-[var(--color-ink)]">
            {t('parent.deleteScheduledBody', { date: new Date(scheduledFor).toLocaleDateString() })}
          </p>
          <div className="flex flex-wrap gap-[var(--space-3)]">
            <button
              type="button"
              onClick={() => void handleCancelSchedule()}
              className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-[var(--space-8)] py-[var(--space-3)] text-[var(--color-surface-high)] shadow-[var(--shadow-pop)]"
              style={{ minHeight: '48px', fontFamily: 'var(--font-display)' }}
            >
              {t('parent.deleteCancel')}
            </button>
            <Link
              href="/parent"
              className="flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-surface)] px-[var(--space-8)] py-[var(--space-3)] text-[var(--color-ink)]"
              style={{ minHeight: '48px', fontFamily: 'var(--font-display)' }}
            >
              {t('parent.backToDashboard')}
            </Link>
          </div>
        </section>
      ) : (
        <section
          aria-label={t('parent.deleteConfirmationAria')}
          className="flex flex-col gap-[var(--space-4)] rounded-[var(--radius-lg)] bg-[var(--color-surface-high)] p-[var(--space-6)] shadow-[var(--shadow-card)]"
        >
          <label className="flex items-start gap-[var(--space-3)] text-base text-[var(--color-ink)]">
            <input
              type="checkbox"
              checked={understood}
              onChange={(e) => handleUnderstoodChange(e.target.checked)}
              className="mt-1 h-6 w-6"
              aria-label={t('parent.deleteUnderstandAria')}
            />
            <span>
              {t('parent.deleteUnderstand')}
            </span>
          </label>

          <label
            htmlFor="delete-confirm-input"
            className="flex flex-col gap-[var(--space-2)] text-base text-[var(--color-ink)]"
          >
            <span>
              {t('parent.deleteTypeConfirm', { word: CONFIRM_WORD })}
            </span>
            <input
              id="delete-confirm-input"
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={!understood}
              autoComplete="off"
              spellCheck={false}
              className="rounded-[var(--radius-md)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-3)] text-base text-[var(--color-ink)] disabled:opacity-50"
              style={{ minHeight: '48px', fontFamily: 'var(--font-mono)' }}
            />
          </label>

          <button
            type="button"
            onClick={handleProceed}
            disabled={!understood || !typedMatches}
            className="self-start rounded-[var(--radius-pill)] bg-[var(--color-alert)] px-[var(--space-8)] py-[var(--space-3)] text-[var(--color-surface-high)] shadow-[var(--shadow-pop)] disabled:opacity-50"
            style={{ minHeight: '48px', fontFamily: 'var(--font-display)' }}
          >
            {t('parent.deleteSchedule')}
          </button>
        </section>
      )}

      <ParentGate
        open={gateOpen}
        onOpenChange={handleGateOpenChange}
        onPass={handleGatePass}
        title={t('gate.title')}
        description={t('parent.deleteGateDescription')}
      />
    </main>
  );
}
