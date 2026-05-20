'use client';

import { MascotFrame, TopBar } from '@e4k/ui';
import { getSetting } from '@e4k/db';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { StreakPlant } from '@/components/streak/StreakPlant';
import { StreakWelcome } from '@/components/streak/StreakWelcome';
import { useStreak } from '@/lib/use-streak';

const SPRINT_2_UNIT = {
  id: '01-me-and-my-world',
  title: 'Me & My World',
  blurbKey: 'play.tapToStart',
};

export default function PlayHomePage() {
  const router = useRouter();
  const t = useTranslations();
  const { state, isReturningToday, grantWeeklyFreezeIfMonday } = useStreak();
  const [nickname, setNickname] = useState<string>('Explorer');
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getSetting<string>('child.nickname', 'Explorer');
      if (!cancelled) setNickname(stored);
    })();
    void grantWeeklyFreezeIfMonday();
    return () => {
      cancelled = true;
    };
  }, [grantWeeklyFreezeIfMonday]);

  const showWelcome = isReturningToday && !welcomeDismissed;

  const blurb = t(SPRINT_2_UNIT.blurbKey);

  return (
    <main className="flex min-h-dvh flex-col bg-[var(--color-surface)]">
      <TopBar
        title={t('play.adventures')}
        onBack={() => router.push('/')}
        onOpenSettings={() => router.push('/settings')}
      />
      <div className="flex w-full flex-col items-end gap-[var(--space-2)] px-[var(--space-4)] pt-[var(--space-4)]">
        <StreakPlant
          current={state.current}
          longest={state.longest}
          freezesAvailable={state.freezesAvailable}
          variant="home"
        />
      </div>
      <section className="flex flex-1 flex-col items-center justify-center gap-[var(--space-6)] px-[var(--space-4)] py-[var(--space-6)]">
        {showWelcome ? (
          <StreakWelcome
            nickname={nickname}
            onDismiss={() => setWelcomeDismissed(true)}
          />
        ) : (
          <h1
            className="text-center text-3xl text-[var(--color-primary-dark)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t('play.helloNickname', { nickname })}
          </h1>
        )}
        <button
          type="button"
          onClick={() => router.push(`/play/${SPRINT_2_UNIT.id}`)}
          className="flex w-full max-w-md flex-col items-center gap-[var(--space-4)] rounded-[var(--radius-xl)] bg-[var(--color-surface-high)] p-[var(--space-6)] shadow-[var(--shadow-pop)] transition-transform duration-[var(--motion-base)] active:scale-95"
          style={{ minHeight: 'var(--tap-primary-young)' }}
          aria-label={t('play.unitTileAria', { title: SPRINT_2_UNIT.title, blurb })}
        >
          <div
            aria-hidden="true"
            className="flex h-32 w-32 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--color-milo)] text-[var(--color-surface-high)] shadow-[var(--shadow-milo)]"
            style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem' }}
          >
            {t('mascot.milo')}
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
            {blurb}
          </p>
        </button>
        <button
          type="button"
          onClick={() => router.push('/garden')}
          className="flex w-full max-w-md items-center justify-between gap-[var(--space-4)] rounded-[var(--radius-lg)] bg-[var(--color-surface-high)] p-[var(--space-5)] shadow-[var(--shadow-card)] transition-transform duration-[var(--motion-base)] active:scale-95"
          style={{ minHeight: 'var(--tap-min-young)' }}
          aria-label={t('play.openWordGarden')}
        >
          <div
            aria-hidden="true"
            className="flex h-16 w-16 items-center justify-center"
          >
            <svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true">
              <circle cx="32" cy="56" r="6" fill="var(--color-muted)" />
              <line
                x1="32"
                y1="56"
                x2="32"
                y2="32"
                stroke="var(--color-success)"
                strokeWidth="3"
              />
              <g transform="translate(32 22)">
                <circle r="8" fill="var(--color-coral)" cx="0" cy="-10" />
                <circle r="8" fill="var(--color-coral)" cx="9" cy="-3" />
                <circle r="8" fill="var(--color-coral)" cx="6" cy="9" />
                <circle r="8" fill="var(--color-coral)" cx="-6" cy="9" />
                <circle r="8" fill="var(--color-coral)" cx="-9" cy="-3" />
                <circle r="5" fill="var(--color-sunflower)" cx="0" cy="0" />
              </g>
            </svg>
          </div>
          <div className="flex flex-col items-start gap-[var(--space-1)]">
            <span
              className="text-xl text-[var(--color-primary-dark)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {t('play.wordGarden')}
            </span>
            <span
              className="text-sm text-[var(--color-mist)]"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {t('play.wordGardenDesc')}
            </span>
          </div>
        </button>
      </section>
      <MascotFrame variant="milo" reaction="waving" />
    </main>
  );
}
