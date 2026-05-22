'use client';

/**
 * Sprint 7 — AgeGate.
 *
 * COPPA / GDPR-K compliance gate: the user answers "Are you 13 or older?"
 * before any sign-up / sign-in form is shown. If the answer is "No", the
 * gate hands control to a ParentGate (math problem) — only a verified
 * adult can proceed to sign in or sign up. Under-13 children stay
 * anonymous-first; they never reach the auth form.
 *
 * The component is intentionally minimal: it owns no copy, no routing,
 * just the binary choice. The consumer:
 *   - passes `onAdult` to advance to sign in / sign up.
 *   - passes `onParentVerified` to advance after the math gate clears.
 *   - passes `onChildStaysAnonymous` to surface a "play as guest" path
 *     for under-13 users whose parent declined to verify.
 *
 * Why not auto-route children to anonymous play? Because the consumer
 * (welcome screen) decides the next step (a child might still want to
 * "wait while my parent gets here"). Decoupled.
 */

import { useState } from 'react';
import { ParentGate } from './ParentGate';
import { cn } from '../utils/cn';

export interface AgeGateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdult: () => void;
  onParentVerified: () => void;
  onChildStaysAnonymous?: () => void;
  className?: string;
  /** Copy override for tests / localization. */
  copy?: {
    title?: string;
    description?: string;
    yes?: string;
    no?: string;
    parentTitle?: string;
    parentDescription?: string;
  };
}

type Stage = 'ask' | 'parent-gate';

export function AgeGate({
  open,
  onOpenChange,
  onAdult,
  onParentVerified,
  onChildStaysAnonymous,
  className,
  copy = {},
}: AgeGateProps) {
  const [stage, setStage] = useState<Stage>('ask');

  if (!open) return null;

  if (stage === 'parent-gate') {
    return (
      <ParentGate
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            // Parent dismissed the gate — fall back to ask stage so the
            // user can pick guest mode or close.
            setStage('ask');
          }
          onOpenChange(next);
        }}
        onPass={() => {
          setStage('ask');
          onParentVerified();
        }}
        title={copy.parentTitle ?? 'Grown-ups only'}
        description={copy.parentDescription ?? 'A parent or guardian needs to continue from here.'}
      />
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.title ?? 'Are you 13 or older?'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(31,41,51,0.55)] p-[var(--space-4)]"
    >
      <div
        className={cn(
          'w-[min(420px,92vw)] rounded-[var(--radius-soft-lg)] bg-[var(--color-surface-high)] p-[var(--space-8)] shadow-[var(--shadow-panel)]',
          className,
        )}
      >
        <h2
          className="text-3xl text-[var(--color-primary-dark)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {copy.title ?? 'Are you 13 or older?'}
        </h2>
        <p className="mt-[var(--space-3)] text-[var(--color-mist)]">
          {copy.description ??
            'We ask so we can offer the right experience. Under-13 visitors stay anonymous and play with a grown-up.'}
        </p>
        <div className="mt-[var(--space-6)] flex flex-col gap-[var(--space-3)]">
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onAdult();
            }}
            className="w-full rounded-[var(--radius-button)] bg-[var(--color-primary)] py-[var(--space-4)] text-lg text-[var(--color-surface-high)]"
            style={{
              minHeight: '56px',
              fontFamily: 'var(--font-display)',
              boxShadow: 'var(--shadow-soft)',
            }}
          >
            {copy.yes ?? "Yes, I'm 13 or older"}
          </button>
          <button
            type="button"
            onClick={() => setStage('parent-gate')}
            className="w-full rounded-[var(--radius-button)] bg-[var(--color-surface)] py-[var(--space-4)] text-lg text-[var(--color-ink)]"
            style={{
              minHeight: '56px',
              fontFamily: 'var(--font-display)',
              boxShadow: 'var(--shadow-soft)',
            }}
          >
            {copy.no ?? "No, I'm under 13"}
          </button>
          {onChildStaysAnonymous ? (
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onChildStaysAnonymous();
              }}
              className="mt-[var(--space-2)] text-sm text-[var(--color-mist)] underline"
            >
              Play as guest instead
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
