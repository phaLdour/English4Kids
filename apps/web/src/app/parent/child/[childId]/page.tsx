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
  const params = useParams<{ childId: string }>();
  const router = useRouter();
  const childId = params?.childId;

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
        setAnnounce('Nickname updated');
      } catch {
        setAnnounce('Could not save. Please try again.');
      }
    } else if (pending.kind === 'ageBand') {
      const next: Child = { ...child, age_band: pending.value, updated_at: now };
      try {
        await db.children.put(next);
        await setSetting('age.band', pending.value);
        setChild(next);
        setEditingAge(false);
        setAnnounce('Age band updated');
      } catch {
        setAnnounce('Could not save. Please try again.');
      }
    }
    setPending(null);
  }, [child, pending]);

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
        <p className="text-[var(--color-ink)]">No child id provided.</p>
        <button
          type="button"
          onClick={() => router.push('/parent')}
          className="self-start rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-[var(--space-6)] py-[var(--space-3)] text-[var(--color-surface-high)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Back to dashboard
        </button>
      </main>
    );
  }

  if (!child) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-[var(--space-4)] p-[var(--space-6)]">
        <p className="text-[var(--color-ink)]">Loading learner...</p>
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
        aria-label="Profile"
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
              Age band {child.age_band} · Created {formatDate(child.created_at)}
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
            Change nickname
          </button>
          <button
            type="button"
            onClick={beginEditAge}
            className="rounded-[var(--radius-pill)] bg-[var(--color-surface)] px-[var(--space-5)] py-[var(--space-2)] text-[var(--color-ink)]"
            style={{ minHeight: '48px', fontFamily: 'var(--font-display)' }}
          >
            Change age band
          </button>
        </div>
      </section>

      {editingNickname ? (
        <section
          aria-label="Edit nickname"
          className="flex flex-col gap-[var(--space-3)] rounded-[var(--radius-lg)] bg-[var(--color-surface-high)] p-[var(--space-5)] shadow-[var(--shadow-card)]"
        >
          <h3
            className="text-lg text-[var(--color-primary-dark)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Pick a nickname
          </h3>
          <div
            role="radiogroup"
            aria-label="Nickname options"
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
              Save
            </button>
            <button
              type="button"
              onClick={cancelEdits}
              className="rounded-[var(--radius-pill)] bg-[var(--color-surface)] px-[var(--space-6)] py-[var(--space-3)] text-[var(--color-ink)]"
              style={{ fontFamily: 'var(--font-display)', minHeight: '48px' }}
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {editingAge ? (
        <section
          aria-label="Edit age band"
          className="flex flex-col gap-[var(--space-3)] rounded-[var(--radius-lg)] bg-[var(--color-surface-high)] p-[var(--space-5)] shadow-[var(--shadow-card)]"
        >
          <h3
            className="text-lg text-[var(--color-primary-dark)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Age band
          </h3>
          <div role="radiogroup" aria-label="Age band options" className="flex flex-col gap-[var(--space-2)]">
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
                  {band === '6-8' ? '6 to 8 (Lower)' : '9 to 12 (Upper)'}
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
              Save
            </button>
            <button
              type="button"
              onClick={cancelEdits}
              className="rounded-[var(--radius-pill)] bg-[var(--color-surface)] px-[var(--space-6)] py-[var(--space-3)] text-[var(--color-ink)]"
              style={{ fontFamily: 'var(--font-display)', minHeight: '48px' }}
            >
              Cancel
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
          Lesson progress
        </h2>
        {progress.length === 0 ? (
          <p className="rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-4)] text-[var(--color-mist)] shadow-[var(--shadow-card)]">
            No lessons recorded yet.
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
                    {p.status} · last {formatDate(p.last_attempt_at)}
                  </span>
                </div>
                <span
                  aria-label={`${p.stars} stars`}
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
          Word garden
        </h2>
        <WordGarden states={gardenStates} view="visual" />
      </section>

      <section aria-labelledby="pron-heading" className="flex flex-col gap-[var(--space-3)]">
        <h2
          id="pron-heading"
          className="px-[var(--space-2)] text-lg text-[var(--color-primary-dark)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Pronunciation scores
        </h2>
        <p className="px-[var(--space-2)] text-sm text-[var(--color-mist)]">
          Scores are shown to parents only. Your child sees encouragement bands instead.
        </p>
        {attemptsByWord.size === 0 ? (
          <p className="rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-4)] text-[var(--color-mist)] shadow-[var(--shadow-card)]">
            No speaking attempts recorded yet.
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
          Activity log
        </h2>
        {recentAudit.length === 0 ? (
          <p className="rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-4)] text-[var(--color-mist)] shadow-[var(--shadow-card)]">
            No recorded events yet.
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
        title="Grown-ups only"
        description="Solve this to save the change."
      />
    </main>
  );
}
