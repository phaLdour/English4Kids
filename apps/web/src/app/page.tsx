import { AudioUnlock } from '@/components/AudioUnlock';

export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-[var(--space-8)] bg-[var(--color-surface)] px-[var(--space-6)] py-[var(--space-10)]">
      <h1
        className="text-center text-4xl text-[var(--color-primary-dark)] sm:text-5xl"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        English4Kids
      </h1>
      <AudioUnlock />
    </main>
  );
}
