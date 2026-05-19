'use client';

import { MascotFrame, TopBar } from '@e4k/ui';
import { useRouter } from 'next/navigation';

const SPRINT_2_UNIT = {
  id: '01-me-and-my-world',
  title: 'Me & My World',
  blurb: 'Tap to start',
};

export default function PlayHomePage() {
  const router = useRouter();
  return (
    <main className="flex min-h-dvh flex-col bg-[var(--color-surface)]">
      <TopBar
        title="Adventures"
        onBack={() => router.push('/')}
        onOpenSettings={() => router.push('/settings')}
      />
      <section className="flex flex-1 flex-col items-center justify-center gap-[var(--space-8)] px-[var(--space-4)] py-[var(--space-8)]">
        <button
          type="button"
          onClick={() => router.push(`/play/${SPRINT_2_UNIT.id}`)}
          className="flex w-full max-w-md flex-col items-center gap-[var(--space-4)] rounded-[var(--radius-xl)] bg-[var(--color-surface-high)] p-[var(--space-6)] shadow-[var(--shadow-pop)] transition-transform duration-[var(--motion-base)] active:scale-95"
          style={{ minHeight: 'var(--tap-primary-young)' }}
          aria-label={`${SPRINT_2_UNIT.title}, ${SPRINT_2_UNIT.blurb}`}
        >
          <div
            aria-hidden="true"
            className="flex h-32 w-32 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--color-milo)] text-[var(--color-surface-high)] shadow-[var(--shadow-milo)]"
            style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem' }}
          >
            Milo
          </div>
          <h2
            className="text-3xl text-[var(--color-primary-dark)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {SPRINT_2_UNIT.title}
          </h2>
          <p
            className="text-lg text-[var(--color-ink)]"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {SPRINT_2_UNIT.blurb}
          </p>
        </button>
      </section>
      <MascotFrame variant="milo" reaction="waving" />
    </main>
  );
}
