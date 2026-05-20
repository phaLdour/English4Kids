'use client';

/**
 * Per-child detail.
 *
 * Layout:
 *   - Profile card with nickname / avatar / age band / created date.
 *   - Edit nickname (curated picker reused from onboarding) — math-gated.
 *   - Edit age band (radio) — math-gated.
 *   - Per-unit progress list with stars per lesson.
 *   - Word Garden full visual view.
 *   - Pronunciation attempts history (parent-only score visibility).
 *   - Audit log (last 20 entries, read-only).
 */

import {
  db,
  setSetting,
  type AuditEvent,
  type Child,
  type Progress,
  type PronunciationAttempt,
  type VocabState,
} from '@e4k/db';
import type { LeitnerBox } from '@e4k/game-engine';
import { ParentGate } from '@e4k/ui';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { WordGarden, type WordGardenState } from '@/components/garden/WordGarden';

type AgeBand = '6-8' | '9-12';

const NICKNAME_OPTIONS = [
  'Sunny Otter',
  'Brave Bunny',
  'Curious Panda',
  'Happy Hedgehog',
  'Gentle Giraffe',
  'Cozy Koala',
  'Cheerful Chick',
  'Friendly Frog',
  'Kind Kitten',
  'Tiny Turtle',
  'Sweet Squirrel',
  'Polite Penguin',
] as const;

function clampBox(n: number): LeitnerBox {
  if (n <= 1) return 1;
  if (n >= 5) return 5;
  return n as LeitnerBox;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return '—';
  }
}

interface SensitiveAction {
  kind: 'nickname';
  value: string;
}

interface SensitiveActionAge {
  kind: 'ageBand';
  value: AgeBand;
}

type PendingAction = SensitiveAction | SensitiveActionAge;

export default function ChildDetailPage() {
  const t = useTranslations();
  const params = useParams<{ childId: string }>();
  const router = useRouter();
  const rawChildId = params?.childId;
  // The Capacitor static export only ships `/parent/child/me` (one
  // sentinel pre-rendered path — see `./layout.tsx`). When the page
  // resolves with `me`, look up the active child from Dexie at runtime;
  // otherwise treat the segment as the literal child UUID.
  const [resolvedChildId, setResolvedChildId] = useState<string | undefined>(
    rawChildId && rawChildId !== 'me' ? rawChildId : undefined,
  );
  useEffect(() => {
    if (!rawChildId) return;
    if (rawChildId !== 'me') {
      setResolvedChildId(rawChildId);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await db.children.toArray();
        if (!cancelled && rows.length > 0 && rows[0]) {
          setResolvedChildId(rows[0].id);
        }
      } catch {
        // Dexie missing — leave undefined; UI will show empty state.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rawChildId]);
  const childId = resolvedChildId;

  const [child, setChild] = useState<Child | null>(null);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [vocab, setVocab] = useState<VocabState[]>([]);
  const [attempts, setAttempts] = useState<PronunciationAttempt[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [editingNickname, setEditingNickname] = useState(false);
  const [editingAge, setEditingAge] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [ageDraft, setAgeDraft] = useState<AgeBand>('6-8');
  const [gateOpen, setGateOpen] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [announce, setAnnounce] = useState('');

  const load = useCallback(async (): Promise<void> => {
    if (!childId) return;
    try {
      const [c, prog, voc, att, aud] = await Promise.all([
        db.children.get(childId),
        db.progress.where('child_id').equals(childId).toArray(),
        db.vocabState.where('child_id').equals(childId).toArray(),
        db.pronunciationAttempts.where('child_id').equals(childId).toArray(),
        db.auditLog.where('child_id').equals(childId).toArray(),
      ]);
      setChild(c ?? null);
      setProgress(prog);
      setVocab(voc);
      setAttempts(att);
      setAudit(aud);
      if (c) {
        setNicknameDraft(c.nickname);
        setAgeDraft(c.age_band);
      }
    } catch {
      // Dexie unavailable — render empty state.
    }
  }, [childId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Group attempts by word_key and keep the last 5 per word.
  const attemptsByWord = useMemo(() => {
    const map = new Map<string, PronunciationAttempt[]>();
    for (const a of attempts) {
      const arr = map.get(a.word_key) ?? [];
      arr.push(a);
      map.set(a.word_key, arr);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort(
        (x, y) => new Date(y.attempted_at).getTime() - new Date(x.attempted_at).getTime(),
      );
      map.set(k, arr.slice(0, 5));
    }
    return map;
  }, [attempts]);

  const gardenStates: WordGardenState[] = useMemo(() => {
    return vocab.map((v) => ({
      word: v.word_key,
      box: clampBox(v.box),
      lastPracticedAt: v.last_seen_at ? new Date(v.last_seen_at) : null,
    }));
  }, [vocab]);

  const recentAudit = useMemo(() => {
    return [...audit]
      .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
      .slice(0, 20);
  }, [audit]);

  const beginEditNickname = useCallback(() => {
    setEditingNickname(true);
  }, []);

  const beginEditAge = useCallback(() => {
    setEditingAge(true);
  }, []);

  const cancelEdits = useCallback(() => {
    setEditingNickname(false);
    setEditingAge(false);
    if (child) {
      setNicknameDraft(child.nickname);
      setAgeDraft(child.age_band);
    }
  }, [child]);

  const requestNicknameSave = useCallback(() => {
    if (!nicknameDraft) return;
    setPending({ kind: 'nickname', value: nicknameDraft });
    setGateOpen(true);
  }, [nicknameDraft]);

  const requestAgeSave = useCallback(() => {
    setPending({ kind: 'ageBand', value: ageDraft });
    setGateOpen(true);
  }, [ageDraft]);

  const applyPending = useCallback(async (): Promise<void> => {
    if (!child || !pending) return;
    const now = new Date().toISOString();
    if (pending.kind === 'nickname') {
      const next: Child = { ...child, nickname: pending.value, updated_at: now };
      try {
        await db.children.put(next);
        await setSetting('child.nickname', pending.value);
        setChild(next);
        setEditingNickname(false);
        setAnnounce(t('parent.childNicknameUpdated'));
      } catch {
        setAnnounce(t('common.couldNotSave'));
      }
    } else if (pending.kind === 'ageBand') {
      const next: Child = { ...child, age_band: pending.value, updated_at: now };
      try {
        await db.children.put(next);
        await setSetting('age.band', pending.value);
        setChild(next);
        setEditingAge(false);
        setAnnounce(t('parent.childAgeBandUpdated'));
      } catch {
        setAnnounce(t('common.couldNotSave'));
      }
    }
    setPending(null);
  }, [child, pending, t]);

  const handleGateOpenChange = useCallback((open: boolean) => {
    setGateOpen(open);
    if (!open) setPending(null);
  }, []);

  const handleGatePass = useCallback(() => {
    void applyPending();
  }, [applyPending]);

  if (!childId) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-[var(--space-4)] p-[var(--space-6)]">
        <p className="text-[var(--color-ink)]">{t('parent.noChildId')}</p>
        <button
          type="button"
          onClick={() => router.push('/parent')}
          className="self-start rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-[var(--space-6)] py-[var(--space-3)] text-[var(--color-surface-high)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t('parent.backToDashboard')}
        </button>
      </main>
    );
  }

  if (!child) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-[var(--space-4)] p-[var(--space-6)]">
        <p className="text-[var(--color-ink)]">{t('parent.loadingLearner')}</p>
      </main>
    );
  }

  return (
    <main
      data-testid="child-detail"
      className="mx-auto flex w-full max-w-3xl flex-col gap-[var(--space-6)] px-[var(--space-4)] py-[var(--space-6)] pb-[var(--space-16)]"
    >
      <span aria-live="polite" className="sr-only">
        {announce}
      </span>

      <section
        aria-label={t('parent.childProfileAria')}
        className="flex flex-col gap-[var(--space-3)] rounded-[var(--radius-lg)] bg-[var(--color-surface-high)] p-[var(--space-5)] shadow-[var(--shadow-card)]"
      >
        <div className="flex items-center gap-[var(--space-4)]">
          <span
            aria-hidden="true"
            className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-milo)] text-2xl text-[var(--color-surface-high)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {child.nickname.slice(0, 1).toUpperCase()}
          </span>
          <div className="flex flex-col">
            <span
              className="text-2xl text-[var(--color-primary-dark)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {child.nickname}
            </span>
            <span className="text-sm text-[var(--color-mist)]">
              {t('parent.childAgeBandLine', { band: child.age_band, date: formatDate(child.created_at) })}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-[var(--space-3)]">
          <button
            type="button"
            onClick={beginEditNickname}
            className="rounded-[var(--radius-pill)] bg-[var(--color-surface)] px-[var(--space-5)] py-[var(--space-2)] text-[var(--color-ink)]"
            style={{ minHeight: '48px', fontFamily: 'var(--font-display)' }}
          >
            {t('parent.childChangeNickname')}
          </button>
          <button
            type="button"
            onClick={beginEditAge}
            className="rounded-[var(--radius-pill)] bg-[var(--color-surface)] px-[var(--space-5)] py-[var(--space-2)] text-[var(--color-ink)]"
            style={{ minHeight: '48px', fontFamily: 'var(--font-display)' }}
          >
            {t('parent.childChangeAgeBand')}
          </button>
        </div>
      </section>

      {editingNickname ? (
        <section
          aria-label={t('parent.childEditNicknameAria')}
          className="flex flex-col gap-[var(--space-3)] rounded-[var(--radius-lg)] bg-[var(--color-surface-high)] p-[var(--space-5)] shadow-[var(--shadow-card)]"
        >
          <h3
            className="text-lg text-[var(--color-primary-dark)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t('parent.childPickNickname')}
          </h3>
          <div
            role="radiogroup"
            aria-label={t('parent.childNicknameOptions')}
            className="grid grid-cols-2 gap-[var(--space-2)] sm:grid-cols-3"
          >
            {NICKNAME_OPTIONS.map((name) => {
              const selected = nicknameDraft === name;
              return (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setNicknameDraft(name)}
                  className="flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface)] p-[var(--space-3)] text-center text-[var(--color-ink)]"
                  style={{
                    minHeight: '56px',
                    outline: selected ? '3px solid var(--color-primary)' : 'none',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
          <div className="flex gap-[var(--space-3)]">
            <button
              type="button"
              onClick={requestNicknameSave}
              className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-[var(--space-6)] py-[var(--space-3)] text-[var(--color-surface-high)]"
              style={{ fontFamily: 'var(--font-display)', minHeight: '48px' }}
            >
              {t('common.save')}
            </button>
            <button
              type="button"
              onClick={cancelEdits}
              className="rounded-[var(--radius-pill)] bg-[var(--color-surface)] px-[var(--space-6)] py-[var(--space-3)] text-[var(--color-ink)]"
              style={{ fontFamily: 'var(--font-display)', minHeight: '48px' }}
            >
              {t('common.cancel')}
            </button>
          </div>
        </section>
      ) : null}

      {editingAge ? (
        <section
          aria-label={t('parent.childEditAgeAria')}
          className="flex flex-col gap-[var(--space-3)] rounded-[var(--radius-lg)] bg-[var(--color-surface-high)] p-[var(--space-5)] shadow-[var(--shadow-card)]"
        >
          <h3
            className="text-lg text-[var(--color-primary-dark)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t('parent.childAgeBand')}
          </h3>
          <div role="radiogroup" aria-label={t('parent.childAgeBandOptions')} className="flex flex-col gap-[var(--space-2)]">
            {(['6-8', '9-12'] as AgeBand[]).map((band) => {
              const selected = ageDraft === band;
              return (
                <button
                  key={band}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setAgeDraft(band)}
                  className="flex items-center gap-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface)] p-[var(--space-3)] text-left text-[var(--color-ink)]"
                  style={{
                    minHeight: '56px',
                    outline: selected ? '3px solid var(--color-primary)' : 'none',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  {band === '6-8' ? t('parent.childAgeBandYounger') : t('parent.childAgeBandOlder')}
                </button>
              );
            })}
          </div>
          <div className="flex gap-[var(--space-3)]">
            <button
              type="button"
              onClick={requestAgeSave}
              className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-[var(--space-6)] py-[var(--space-3)] text-[var(--color-surface-high)]"
              style={{ fontFamily: 'var(--font-display)', minHeight: '48px' }}
            >
              {t('common.save')}
            </button>
            <button
              type="button"
              onClick={cancelEdits}
              className="rounded-[var(--radius-pill)] bg-[var(--color-surface)] px-[var(--space-6)] py-[var(--space-3)] text-[var(--color-ink)]"
              style={{ fontFamily: 'var(--font-display)', minHeight: '48px' }}
            >
              {t('common.cancel')}
            </button>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="progress-heading" className="flex flex-col gap-[var(--space-3)]">
        <h2
          id="progress-heading"
          className="px-[var(--space-2)] text-lg text-[var(--color-primary-dark)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t('parent.childLessonProgress')}
        </h2>
        {progress.length === 0 ? (
          <p className="rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-4)] text-[var(--color-mist)] shadow-[var(--shadow-card)]">
            {t('parent.childNoLessons')}
          </p>
        ) : (
          <ul className="flex flex-col gap-[var(--space-2)]">
            {progress.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-3)] shadow-[var(--shadow-card)]"
              >
                <div className="flex flex-col">
                  <span
                    className="text-base text-[var(--color-ink)]"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {p.lesson_id}
                  </span>
                  <span className="text-sm text-[var(--color-mist)]">
                    {t('parent.childStatusLine', { status: p.status, date: formatDate(p.last_attempt_at) })}
                  </span>
                </div>
                <span
                  aria-label={t('parent.starsAria', { count: p.stars })}
                  className="text-[var(--color-sunflower)]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {'★'.repeat(Math.max(0, Math.min(3, p.stars)))}
                  <span aria-hidden="true" className="text-[var(--color-muted)]">
                    {'★'.repeat(Math.max(0, 3 - p.stars))}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="garden-full-heading" className="flex flex-col gap-[var(--space-3)]">
        <h2
          id="garden-full-heading"
          className="px-[var(--space-2)] text-lg text-[var(--color-primary-dark)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t('parent.childWordGarden')}
        </h2>
        <WordGarden states={gardenStates} view="visual" />
      </section>

      <section aria-labelledby="pron-heading" className="flex flex-col gap-[var(--space-3)]">
        <h2
          id="pron-heading"
          className="px-[var(--space-2)] text-lg text-[var(--color-primary-dark)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t('parent.childPronScores')}
        </h2>
        <p className="px-[var(--space-2)] text-sm text-[var(--color-mist)]">
          {t('parent.childPronDesc')}
        </p>
        {attemptsByWord.size === 0 ? (
          <p className="rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-4)] text-[var(--color-mist)] shadow-[var(--shadow-card)]">
            {t('parent.childNoAttempts')}
          </p>
        ) : (
          <ul className="flex flex-col gap-[var(--space-2)]">
            {Array.from(attemptsByWord.entries()).map(([word, list]) => (
              <li
                key={word}
                className="flex flex-col gap-[var(--space-2)] rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-3)] shadow-[var(--shadow-card)]"
              >
                <span
                  className="text-base text-[var(--color-ink)]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {word}
                </span>
                <div className="flex flex-wrap gap-[var(--space-2)]">
                  {list.map((a) => (
                    <span
                      key={a.id}
                      className="rounded-[var(--radius-pill)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-1)] text-sm text-[var(--color-ink)]"
                      title={`${a.band} · ${a.engine} · ${formatDate(a.attempted_at)}`}
                    >
                      {a.score}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="audit-heading" className="flex flex-col gap-[var(--space-3)]">
        <h2
          id="audit-heading"
          className="px-[var(--space-2)] text-lg text-[var(--color-primary-dark)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t('parent.childActivityLog')}
        </h2>
        {recentAudit.length === 0 ? (
          <p className="rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-4)] text-[var(--color-mist)] shadow-[var(--shadow-card)]">
            {t('parent.childNoEvents')}
          </p>
        ) : (
          <ul className="flex flex-col gap-[var(--space-1)]">
            {recentAudit.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface-high)] px-[var(--space-3)] py-[var(--space-2)] shadow-[var(--shadow-card)]"
              >
                <span className="text-sm text-[var(--color-ink)]">{e.event_type}</span>
                <span className="text-sm text-[var(--color-mist)]">
                  {new Date(e.occurred_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ParentGate
        open={gateOpen}
        onOpenChange={handleGateOpenChange}
        onPass={handleGatePass}
        title={t('gate.title')}
        description={t('parent.childGateDescription')}
      />
    </main>
  );
}
