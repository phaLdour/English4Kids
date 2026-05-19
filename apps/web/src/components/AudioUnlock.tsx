'use client';

import { useState } from 'react';

export function AudioUnlock() {
  const [unlocked, setUnlocked] = useState(false);

  if (unlocked) {
    return (
      <p
        className="text-center text-2xl text-[var(--color-ink)]"
        aria-live="polite"
      >
        Adventure starting soon!
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-[var(--space-6)]">
      <div
        aria-hidden="true"
        className="flex h-40 w-40 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--color-milo)] text-[var(--color-surface-high)] shadow-[var(--shadow-milo)]"
        style={{ fontFamily: 'var(--font-display)', fontSize: '2rem' }}
      >
        Milo
      </div>
      <p
        className="max-w-md text-center text-2xl text-[var(--color-ink)]"
        id="audio-unlock-label"
      >
        Tap to start your adventure!
      </p>
      <button
        type="button"
        aria-labelledby="audio-unlock-label"
        onClick={() => setUnlocked(true)}
        className="flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-[var(--space-10)] text-[var(--color-surface-high)] shadow-[var(--shadow-pop)] transition-transform duration-[var(--motion-fast)] active:scale-95"
        style={{
          minHeight: 'var(--tap-primary-young)',
          minWidth: 'var(--tap-primary-young)',
          fontFamily: 'var(--font-display)',
          fontSize: '1.5rem',
        }}
      >
        Start
      </button>
    </div>
  );
}
