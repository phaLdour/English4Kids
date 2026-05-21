'use client';

import { MascotFrame, TopBar } from '@e4k/ui';
import type { Lesson, Unit } from '@e4k/content-schema';
import { db } from '@e4k/db';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getUnit } from '@/lib/content-client';
import { getOrCreateGuestChild } from '@/lib/lesson-player';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; unit: Unit; stars: Record<string, number> };

export default function UnitMapPage() {
  const router = useRouter();
  const t = useTranslations();
  const params = useParams<{ unitId: string }>();
  const unitId = Array.isArray(params.unitId) ? params.unitId[0] : params.unitId;
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // S4-10: routed through `content-client` so static export and SSR
        // share a single code path.
        let unit: Unit;
        try {
          unit = await getUnit(unitId);
        } catch {
          if (!cancelled) setState({ kind: 'error', message: t('play.unitOnTheWay') });
          return;
        }
        const child = await getOrCreateGuestChild();
        const stars: Record<string, number> = {};
        try {
          const rows = await db.progress.where('child_id').equals(child.id).toArray();
          for (const r of rows) {
            stars[r.lesson_id] = r.stars;
          }
        } catch {
          // ignore storage failure
        }
        if (!cancelled) setState({ kind: 'ready', unit, stars });
      } catch {
        if (!cancelled) setState({ kind: 'error', message: t('play.couldNotLoadUnit') });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [unitId, t]);

  return (
    <main className="flex min-h-dvh flex-col bg-[var(--color-surface)]">
      <TopBar
        title={state.kind === 'ready' ? state.unit.title : t('play.unitDefault')}
        onBack={() => router.push('/play')}
        onOpenSettings={() => router.push('/settings')}
      />
      <section className="flex flex-1 flex-col items-center gap-[var(--space-6)] px-[var(--space-4)] py-[var(--space-6)]">
        {state.kind === 'loading' ? (
          <p aria-live="polite" className="text-lg text-[var(--color-ink)]">
            {t('play.loadingDots')}
          </p>
        ) : null}
        {state.kind === 'error' ? (
          <p aria-live="polite" className="text-lg text-[var(--color-ink)]">
            {state.message}
          </p>
        ) : null}
        {state.kind === 'ready' ? (
          <ul className="flex w-full max-w-2xl flex-col gap-[var(--space-4)]">
            {state.unit.lessons.map((lesson) => (
              <li key={lesson.id}>
                <LessonCard
                  lesson={lesson}
                  stars={state.stars[lesson.id] ?? 0}
                  onSelect={() => router.push(`/play/${unitId}/lesson/${lesson.id}`)}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <MascotFrame variant="milo" reaction="idle" />
    </main>
  );
}

interface LessonCardProps {
  lesson: Lesson;
  stars: number;
  onSelect: () => void;
}

function LessonCard({ lesson, stars, onSelect }: LessonCardProps) {
  const t = useTranslations();
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={t('play.lessonStarsAria', { title: lesson.title, stars })}
      className="flex w-full items-center justify-between gap-[var(--space-4)] rounded-[var(--radius-lg)] bg-[var(--color-surface-high)] px-[var(--space-5)] py-[var(--space-4)] text-left shadow-[var(--shadow-card)] transition-transform duration-[var(--motion-base)] active:scale-[0.98]"
      style={{ minHeight: 'var(--tap-primary-young)' }}
    >
      <div className="flex flex-col">
        <span
          className="text-xl text-[var(--color-primary-dark)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {lesson.title}
        </span>
        <span
          className="text-sm text-[var(--color-mist)]"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {lesson.miniTheme}
        </span>
      </div>
      <div
        aria-hidden="true"
        className="flex items-center gap-[var(--space-1)]"
        style={{ fontSize: '1.5rem' }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={`star-${lesson.id}-${i}`}
            style={{
              color: i < stars ? 'var(--color-sunflower)' : 'var(--color-muted)',
            }}
          >
            ★
          </span>
        ))}
      </div>
    </button>
  );
}
