// SAFETY INVARIANTS (do NOT change without Safety Officer sign-off):
// - This component is UI only. It does NOT touch `navigator.mediaDevices`
//   or instantiate any audio APIs. Its sole job is to make mic activity
//   visible to the child and provide a one-tap "Stop talking" affordance.
// - It is mounted in the root layout so the indicator is GLOBAL — there is
//   no path through the app that listens to the mic without this indicator
//   being visible.

'use client';

import { useTranslations } from 'next-intl';
import { useMicStore } from '@/lib/mic-store';

export function MicIndicator() {
  const active = useMicStore((s) => s.active);
  const requestStop = useMicStore((s) => s.requestStop);
  const t = useTranslations();

  if (!active) return null;

  return (
    <output
      aria-live="polite"
      data-testid="mic-indicator"
      className="fixed right-[var(--space-3)] top-[var(--space-3)] z-50 flex items-center gap-[var(--space-2)] rounded-[var(--radius-pill)] bg-[var(--color-surface-high)] px-[var(--space-3)] py-[var(--space-2)] shadow-[var(--shadow-pop)]"
      style={{ fontFamily: 'var(--font-display)' }}
    >
      <span
        aria-hidden="true"
        className="block h-3 w-3 animate-pulse rounded-[var(--radius-pill)]"
        style={{
          backgroundColor: 'var(--color-mic-live)',
          boxShadow: '0 0 0 4px rgba(230, 57, 70, 0.25)',
        }}
      />
      <span className="text-sm text-[var(--color-ink)]">{t('mic.listening')}</span>
      <button
        type="button"
        onClick={requestStop}
        className="ml-[var(--space-2)] rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-[var(--space-4)] py-[var(--space-2)] text-sm text-[var(--color-surface-high)] shadow-[var(--shadow-card)] transition-transform duration-[var(--motion-fast)] active:scale-95"
        style={{ minHeight: 'var(--tap-min-old)', minWidth: 'var(--tap-min-old)' }}
        aria-label={t('mic.stopAria')}
      >
        {t('mic.stop')}
      </button>
    </output>
  );
}
