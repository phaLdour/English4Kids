'use client';

import { MascotFrame, TopBar } from '@e4k/ui';
import { getSetting } from '@e4k/db';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { StreakPlant } from '@/components/streak/StreakPlant';
import { StreakWelcome } from '@/components/streak/StreakWelcome';
import { getUnitsIndex, type UnitIndexEntry } from '@/lib/content-client';
import { useStreak } from '@/lib/use-streak';

type UnitsState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; units: UnitIndexEntry[] };

export default function PlayHomePage() {
  const router = useRouter();
  const t = useTranslations();
  const { state, isReturningToday, grantWeeklyFreezeIfMonday } = useStreak();
  const [nickname, setNickname] = useState<string>('Explorer');
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [unitsState, setUnitsState] = useState<UnitsState>({ kind: 'loading' });

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

  // Fetch the unit catalogue once on mount. Routed through the units-index
  // endpoint so the static (Capacitor) build and the web build share the
  // same code path.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const units = await getUnitsIndex();
        if (!cancelled) setUnitsState({ kind: 'ready', units });
      } catch {
        if (!cancelled) setUnitsState({ kind: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const showWelcome = isReturningToday && !welcomeDismissed;
  const blurb = t('play.tapToStart');

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
      <section className="flex flex-1 flex-col items-center gap-[var(--space-6)] px-[var(--space-4)] py-[var(--space-6)]">
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

        {unitsState.kind === 'loading' ? (
          <ul
            aria-busy="true"
            aria-label={t('play.loadingDots')}
            className="flex w-full max-w-md flex-col gap-[var(--space-4)]"
          >
            {/* Three pulsing skeleton tiles matching the real unit-card
                shape. Keeps the layout from shifting when the data lands.
                Pure CSS animation — honors `prefers-reduced-motion` via
                the globals.css override. */}
            {[0, 1, 2].map((i) => (
              <li
                key={`tile-skel-${i}`}
                className="flex h-44 w-full animate-pulse flex-col items-center gap-[var(--space-3)] rounded-[var(--radius-xl)] bg-[var(--color-surface-high)] p-[var(--space-5)] shadow-[var(--shadow-card)]"
                aria-hidden="true"
              >
                <div className="h-20 w-20 rounded-[var(--radius-xl)] bg-[var(--color-muted)] opacity-40" />
                <div className="h-6 w-2/3 rounded-[var(--radius-pill)] bg-[var(--color-muted)] opacity-40" />
                <div className="h-4 w-1/2 rounded-[var(--radius-pill)] bg-[var(--color-muted)] opacity-30" />
              </li>
            ))}
          </ul>
        ) : null}

        {unitsState.kind === 'error' ? (
          <p aria-live="polite" className="text-lg text-[var(--color-ink)]">
            {t('play.couldNotLoadUnit')}
          </p>
        ) : null}

        {unitsState.kind === 'ready' ? (
          <ul className="flex w-full max-w-md flex-col gap-[var(--space-4)]">
            {unitsState.units.map((unit, index) => (
              <li key={unit.id}>
                <UnitTile
                  unit={unit}
                  // Alternate Milo (index 0, 2, 4...) and Luna (index 1, 3...) so
                  // the parity contract reads visually on the home grid too.
                  mascot={index % 2 === 0 ? 'milo' : 'luna'}
                  blurb={blurb}
                  onSelect={() => router.push(`/play/${unit.id}`)}
                />
              </li>
            ))}
          </ul>
        ) : null}

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

interface UnitTileProps {
  unit: UnitIndexEntry;
  mascot: 'milo' | 'luna';
  blurb: string;
  onSelect: () => void;
}

function UnitTile({ unit, mascot, blurb, onSelect }: UnitTileProps) {
  const t = useTranslations();
  const mascotName = t(`mascot.${mascot}`);
  const swatchClass = mascot === 'milo' ? 'bg-[var(--color-milo)]' : 'bg-[var(--color-luna)]';
  const swatchShadow = mascot === 'milo' ? 'var(--shadow-milo)' : 'var(--shadow-luna)';

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full flex-col items-center gap-[var(--space-3)] rounded-[var(--radius-xl)] bg-[var(--color-surface-high)] p-[var(--space-5)] shadow-[var(--shadow-pop)] transition-transform duration-[var(--motion-base)] active:scale-95"
      style={{ minHeight: 'var(--tap-primary-young)' }}
      aria-label={t('play.unitTileAria', { title: unit.title, blurb })}
    >
      <div
        aria-hidden="true"
        className={`flex h-24 w-24 items-center justify-center rounded-[var(--radius-xl)] text-[var(--color-surface-high)] ${swatchClass}`}
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.25rem',
          boxShadow: swatchShadow,
        }}
      >
        {mascotName}
      </div>
      <h2
        className="text-center text-2xl text-[var(--color-primary-dark)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {unit.title}
      </h2>
      <p
        className="text-center text-base text-[var(--color-ink)]"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        {unit.theme}
      </p>
      <p
        className="text-sm text-[var(--color-mist)]"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        {t('play.lessonCount', { count: unit.lessonCount })}
      </p>
    </button>
  );
}
