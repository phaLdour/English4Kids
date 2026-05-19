'use client';

/**
 * Parent Dashboard — home.
 *
 * Reads the active child profile + derived stats from Dexie (local-first).
 * Layout:
 *   1. ChildSwitcher (single-child MVP, plural-ready UI).
 *   2. Today's snapshot — time, lessons, new words, attempts.
 *   3. Weekly minutes bar chart (custom SVG, no chart library).
 *   4. Word Garden list-view snapshot.
 *   5. Streak section with the "never punitive" copy.
 *   6. Recent activity list (last 10 lessons).
 *   7. Navigation tiles: Child Details / Settings / Export / Delete / Account.
 */

import { db, getSetting, type Child, type VocabState } from '@e4k/db';
import type { LeitnerBox } from '@e4k/game-engine';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { WordGarden, type WordGardenState } from '@/components/garden/WordGarden';
import { StreakPlant } from '@/components/streak/StreakPlant';
import { useChildStats, type ChildStats, type DailyMinutes } from '@/lib/use-child-stats';

interface StreakSnapshot {
  current: number;
  longest: number;
  freezesAvailable: number;
}

const DEFAULT_STREAK: StreakSnapshot = {
  current: 0,
  longest: 0,
  freezesAvailable: 0,
};

function formatMinutes(min: number): string {
  if (min <= 0) return '0 min';
  if (min < 60) return `${min} min`;
  const hours = Math.floor(min / 60);
  const rest = min % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

function clampBox(n: number): LeitnerBox {
  if (n <= 1) return 1;
  if (n >= 5) return 5;
  return n as LeitnerBox;
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex min-w-[140px] flex-1 flex-col items-center gap-[var(--space-1)] rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-4)] text-center shadow-[var(--shadow-card)]"
      style={{ minHeight: '88px' }}
    >
      <span
        className="text-2xl text-[var(--color-primary-dark)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {value}
      </span>
      <span className="text-sm text-[var(--color-mist)]">{label}</span>
    </div>
  );
}

/**
 * Custom SVG bar chart for the past 7 days. No chart library: we want a
 * pastel, calm visual and tiny dependency footprint. Bars normalise to the
 * day with the most minutes (capped at 60 so a single big day doesn't crush
 * the others into invisibility).
 */
function WeeklyChart({ days }: { days: DailyMinutes[] }) {
  const max = useMemo(() => {
    const peak = days.reduce((m, d) => Math.max(m, d.minutes), 0);
    return Math.max(peak, 30);
  }, [days]);
  const width = 320;
  const height = 160;
  const padding = { top: 12, right: 8, bottom: 28, left: 8 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const barCount = Math.max(days.length, 1);
  const barGap = 8;
  const barWidth = (innerW - barGap * (barCount - 1)) / barCount;

  return (
    <figure
      aria-label="Daily minutes for the past 7 days"
      className="flex w-full flex-col gap-[var(--space-2)] rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-4)] shadow-[var(--shadow-card)]"
    >
      <figcaption
        className="text-sm text-[var(--color-mist)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        This week
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-hidden="true"
        className="w-full"
        style={{ maxHeight: 200 }}
      >
        {days.map((d, i) => {
          const h = max > 0 ? (d.minutes / max) * innerH : 0;
          const x = padding.left + i * (barWidth + barGap);
          const y = padding.top + (innerH - h);
          return (
            <g key={d.day}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(h, 2)}
                rx={6}
                ry={6}
                fill="var(--color-primary)"
                opacity={d.minutes === 0 ? 0.3 : 0.85}
              />
              <text
                x={x + barWidth / 2}
                y={padding.top + innerH + 18}
                textAnchor="middle"
                fontSize="11"
                fill="var(--color-mist)"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="sr-only">
        {days.map((d) => (
          <li key={`a-${d.day}`}>
            {d.label} {d.day}: {d.minutes} minutes
          </li>
        ))}
      </ul>
    </figure>
  );
}

function ChildSwitcher({
  children,
  activeId,
  onPick,
}: {
  children: Child[];
  activeId: string | undefined;
  onPick: (id: string) => void;
}) {
  if (children.length === 0) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-4)] text-center text-[var(--color-mist)] shadow-[var(--shadow-card)]"
        style={{ minHeight: '64px' }}
      >
        No learner profile yet.
      </div>
    );
  }
  return (
    <div
      role="radiogroup"
      aria-label="Choose a learner"
      className="flex w-full flex-wrap gap-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-3)] shadow-[var(--shadow-card)]"
    >
      {children.map((c) => {
        const selected = c.id === activeId;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onPick(c.id)}
            className="flex items-center gap-[var(--space-3)] rounded-[var(--radius-pill)] bg-[var(--color-surface)] px-[var(--space-4)] py-[var(--space-2)] transition-transform duration-[var(--motion-fast)] active:scale-[0.98]"
            style={{
              minHeight: '56px',
              outline: selected ? '3px solid var(--color-primary)' : 'none',
              fontFamily: 'var(--font-display)',
            }}
          >
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-milo)] text-base text-[var(--color-surface-high)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {c.nickname.slice(0, 1).toUpperCase()}
            </span>
            <span className="text-base text-[var(--color-ink)]">{c.nickname}</span>
          </button>
        );
      })}
    </div>
  );
}

function NavTile({
  href,
  title,
  description,
  disabled = false,
}: {
  href: string;
  title: string;
  description: string;
  disabled?: boolean;
}) {
  const body = (
    <div
      className="flex h-full w-full flex-col gap-[var(--space-2)] rounded-[var(--radius-lg)] bg-[var(--color-surface-high)] p-[var(--space-5)] shadow-[var(--shadow-card)] transition-transform duration-[var(--motion-fast)]"
      style={{
        minHeight: '120px',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <span
        className="text-lg text-[var(--color-primary-dark)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {title}
      </span>
      <span className="text-sm text-[var(--color-mist)]">{description}</span>
    </div>
  );
  if (disabled) {
    return (
      <div
        aria-disabled="true"
        role="link"
        tabIndex={-1}
        className="block w-full"
      >
        {body}
      </div>
    );
  }
  return (
    <Link href={href} className="block w-full">
      {body}
    </Link>
  );
}

function RecentLessonsList({ stats }: { stats: ChildStats }) {
  if (stats.recentLessons.length === 0) {
    return (
      <p className="rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-4)] text-[var(--color-mist)] shadow-[var(--shadow-card)]">
        Start a lesson together to see your child&rsquo;s progress here.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-[var(--space-2)]">
      {stats.recentLessons.map((l) => (
        <li
          key={`${l.lessonId}-${l.completedAt.toISOString()}`}
          className="flex items-center justify-between gap-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-3)] shadow-[var(--shadow-card)]"
        >
          <div className="flex flex-col">
            <span
              className="text-base text-[var(--color-ink)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {l.title}
            </span>
            <span className="text-sm text-[var(--color-mist)]">
              {l.completedAt.toLocaleDateString()}{' '}
              {l.completedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <span
            aria-label={`${l.stars} stars`}
            className="text-base text-[var(--color-sunflower)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {'★'.repeat(Math.max(0, Math.min(3, l.stars)))}
            <span aria-hidden="true" className="text-[var(--color-muted)]">
              {'★'.repeat(Math.max(0, 3 - l.stars))}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function ParentDashboardPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [activeChildId, setActiveChildId] = useState<string | undefined>(undefined);
  const [vocab, setVocab] = useState<VocabState[]>([]);
  const [streak, setStreak] = useState<StreakSnapshot>(DEFAULT_STREAK);
  const [scheduledDelete, setScheduledDelete] = useState<number | null>(null);
  const [loadingChildren, setLoadingChildren] = useState(true);

  const { stats, loading } = useChildStats(activeChildId);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await db.children.toArray();
        if (cancelled) return;
        setChildren(rows);
        if (rows.length > 0 && rows[0]) {
          setActiveChildId(rows[0].id);
        }
      } catch {
        // Dexie unavailable — render empty state.
      } finally {
        if (!cancelled) setLoadingChildren(false);
      }
      try {
        const streakStored = await getSetting<StreakSnapshot | null>('streak.state', null);
        if (!cancelled && streakStored) setStreak(streakStored);
        const sched = await getSetting<number | null>('parent.deletion.scheduledFor', null);
        if (!cancelled) setScheduledDelete(sched);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeChildId) {
      setVocab([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const rows = await db.vocabState.where('child_id').equals(activeChildId).toArray();
        if (!cancelled) setVocab(rows);
      } catch {
        if (!cancelled) setVocab([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeChildId]);

  const gardenStates: WordGardenState[] = useMemo(() => {
    return vocab
      .slice()
      .sort((a, b) => {
        const ta = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
        const tb = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 12)
      .map((v) => ({
        word: v.word_key,
        box: clampBox(v.box),
        lastPracticedAt: v.last_seen_at ? new Date(v.last_seen_at) : null,
      }));
  }, [vocab]);

  const empty = !loading && !loadingChildren && (stats === null || stats.recentLessons.length === 0);

  return (
    <main
      data-testid="parent-dashboard"
      className="mx-auto flex w-full max-w-3xl flex-col gap-[var(--space-6)] px-[var(--space-4)] py-[var(--space-6)] pb-[var(--space-16)]"
    >
      <ChildSwitcher
        children={children}
        activeId={activeChildId}
        onPick={setActiveChildId}
      />

      {scheduledDelete !== null ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-4)] shadow-[var(--shadow-card)]"
          style={{ borderLeft: '6px solid var(--color-alert)' }}
        >
          <p className="text-base text-[var(--color-ink)]">
            Deletion scheduled for {new Date(scheduledDelete).toLocaleDateString()}.{' '}
            <Link
              href="/parent/delete"
              className="text-[var(--color-primary-dark)] underline"
            >
              Open Parent Dashboard before then to cancel.
            </Link>
          </p>
        </div>
      ) : null}

      <section aria-labelledby="snapshot-heading" className="flex flex-col gap-[var(--space-3)]">
        <h2
          id="snapshot-heading"
          className="px-[var(--space-2)] text-lg text-[var(--color-primary-dark)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Today
        </h2>
        <div className="flex flex-wrap gap-[var(--space-3)]">
          <StatChip
            label="Time today"
            value={loading ? '—' : formatMinutes(stats?.todayMinutes ?? 0)}
          />
          <StatChip
            label="Lessons today"
            value={loading ? '—' : String(stats?.todayLessons ?? 0)}
          />
          <StatChip
            label="New words"
            value={loading ? '—' : String(stats?.todayNewWords ?? 0)}
          />
          <StatChip
            label="Speaking attempts"
            value={loading ? '—' : String(stats?.todayPronunciationAttempts ?? 0)}
          />
        </div>
      </section>

      <section aria-labelledby="weekly-heading" className="flex flex-col gap-[var(--space-3)]">
        <h2
          id="weekly-heading"
          className="px-[var(--space-2)] text-lg text-[var(--color-primary-dark)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Past 7 days
        </h2>
        <WeeklyChart days={stats?.weeklyMinutes ?? []} />
      </section>

      <section aria-labelledby="garden-heading" className="flex flex-col gap-[var(--space-3)]">
        <h2
          id="garden-heading"
          className="px-[var(--space-2)] text-lg text-[var(--color-primary-dark)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Word garden
        </h2>
        <WordGarden states={gardenStates} view="list" />
      </section>

      <section aria-labelledby="streak-heading" className="flex flex-col gap-[var(--space-3)]">
        <h2
          id="streak-heading"
          className="px-[var(--space-2)] text-lg text-[var(--color-primary-dark)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Streak
        </h2>
        <StreakPlant
          current={streak.current}
          longest={streak.longest}
          freezesAvailable={streak.freezesAvailable}
          variant="detail"
        />
        <p className="px-[var(--space-2)] text-sm text-[var(--color-mist)]">
          Streaks cannot be lost punitively. Missed days are forgiven with a freeze, and a new
          plant starts whenever your child is ready.
        </p>
      </section>

      <section aria-labelledby="recent-heading" className="flex flex-col gap-[var(--space-3)]">
        <h2
          id="recent-heading"
          className="px-[var(--space-2)] text-lg text-[var(--color-primary-dark)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Recent lessons
        </h2>
        {empty ? (
          <p className="rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-4)] text-[var(--color-mist)] shadow-[var(--shadow-card)]">
            Start a lesson together to see your child&rsquo;s progress here.
          </p>
        ) : stats ? (
          <RecentLessonsList stats={stats} />
        ) : null}
      </section>

      <section aria-labelledby="nav-heading" className="flex flex-col gap-[var(--space-3)]">
        <h2
          id="nav-heading"
          className="px-[var(--space-2)] text-lg text-[var(--color-primary-dark)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Manage
        </h2>
        <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
          <NavTile
            href={activeChildId ? `/parent/child/${activeChildId}` : '/parent'}
            title="Child details"
            description="Profile, progress, audit log."
          />
          <NavTile
            href="/parent/settings"
            title="Settings"
            description="Microphone, strictness, daily limit."
          />
          <NavTile
            href="/parent/export"
            title="Data export"
            description="Download everything as JSON."
          />
          <NavTile
            href="/parent/delete"
            title="Delete all data"
            description="Schedule a wipe with a 7-day grace."
          />
          <NavTile
            href="/parent/account"
            title="Account upgrade"
            description="Coming soon."
            disabled
          />
        </div>
      </section>
    </main>
  );
}
