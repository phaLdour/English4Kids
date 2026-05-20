'use client';

import { AudioUnlock as AudioUnlockLib } from '@e4k/audio';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getAudioClient } from '@/lib/audio-client';

export function AudioUnlock() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleStart = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await AudioUnlockLib.unlock();
      await getAudioClient();
    } catch {
      // proceed regardless — UI must not block
    }
    router.push('/play');
  };

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
        onClick={handleStart}
        disabled={busy}
        className="flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-[var(--space-10)] text-[var(--color-surface-high)] shadow-[var(--shadow-pop)] transition-transform duration-[var(--motion-fast)] active:scale-95 disabled:opacity-60"
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
