'use client';

import { MascotFrame, TopBar } from '@e4k/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { WordGarden, type WordGardenState } from '@/components/garden/WordGarden';
import { useVocabState } from '@/lib/use-vocab-state';
import { getOrCreateGuestChild } from '@/lib/lesson-player';

function speakWord(word: string): void {
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  try {
    const u = new SpeechSynthesisUtterance(word);
    u.rate = 0.9;
    synth.cancel();
    synth.speak(u);
  } catch {
    // ignore
  }
}

export default function GardenPage() {
  const router = useRouter();
  const search = useSearchParams();
  const view = search.get('view') === 'list' ? 'list' : 'visual';
  const [childId, setChildId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const child = await getOrCreateGuestChild();
      if (!cancelled) setChildId(child.id);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { states, loading } = useVocabState(childId);

  const gardenStates = useMemo<WordGardenState[]>(
    () =>
      states.map((s) => ({
        word: s.word,
        box: s.box,
        lastPracticedAt: s.last_practiced_at,
      })),
    [states],
  );

  return (
    <main className="flex min-h-dvh flex-col bg-[var(--color-surface)]">
      <TopBar
        title="Word Garden"
        onBack={() => router.push('/play')}
        onOpenSettings={() => router.push('/settings')}
      />
      <section className="flex flex-1 flex-col items-center gap-[var(--space-6)] px-[var(--space-4)] py-[var(--space-6)]">
        {loading ? (
          <p
            aria-live="polite"
            className="text-lg text-[var(--color-mist)]"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Loading your garden…
          </p>
        ) : (
          <WordGarden
            states={gardenStates}
            view={view}
            onPlantTap={view === 'visual' ? speakWord : undefined}
          />
        )}
      </section>
      <MascotFrame variant="milo" reaction="idle" />
    </main>
  );
}
