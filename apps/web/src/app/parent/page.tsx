'use client';

import { ParentGate } from '@e4k/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Parent Dashboard placeholder (Sprint 2).
 *
 * Real dashboard ships in Sprint 3. This stub enforces the ParentGate so the
 * gate-flow can be exercised end-to-end now. If the parent abandons the gate
 * we bounce back to the previous page rather than stranding them on a blank
 * screen.
 */
export default function ParentPage() {
  const router = useRouter();
  const [gateOpen, setGateOpen] = useState(true);
  const [passed, setPassed] = useState(false);

  const handleGateOpenChange = (open: boolean): void => {
    setGateOpen(open);
    if (!open && !passed) router.back();
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-[var(--space-6)] bg-[var(--color-surface)] px-[var(--space-6)] py-[var(--space-10)]">
      {passed ? (
        <>
          <h1
            className="text-center text-3xl text-[var(--color-primary-dark)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Parent Dashboard
          </h1>
          <p className="max-w-prose text-center text-lg text-[var(--color-ink)]">
            Coming in Sprint 3. You will be able to review your learner&rsquo;s progress,
            tune pronunciation strictness, and manage downloads here.
          </p>
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-[var(--space-8)] text-[var(--color-surface-high)] shadow-[var(--shadow-pop)]"
            style={{
              minHeight: 'var(--tap-primary-old)',
              fontFamily: 'var(--font-display)',
              fontSize: '1.125rem',
            }}
          >
            Back
          </button>
        </>
      ) : (
        <p
          aria-live="polite"
          className="text-center text-lg text-[var(--color-ink)]"
        >
          Verifying grown-up access...
        </p>
      )}

      <ParentGate
        open={gateOpen}
        onOpenChange={handleGateOpenChange}
        onPass={() => setPassed(true)}
        title="Grown-ups only"
        description="Solve this to open the parent dashboard."
      />
    </main>
  );
}
