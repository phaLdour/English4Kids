'use client';

import { type AudioAssetMap, AudioAssetMapSchema } from '@e4k/content-schema';
import { db } from '@e4k/db';
import type { Child, Progress } from '@e4k/db';
import type { AttemptResult } from '@e4k/game-engine';

export async function loadAudioMap(unitId: string): Promise<AudioAssetMap> {
  const res = await fetch(`/api/content/${encodeURIComponent(unitId)}/audio`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    return {};
  }
  const json = (await res.json()) as unknown;
  const parsed = AudioAssetMapSchema.safeParse(json);
  if (!parsed.success) return {};
  return parsed.data;
}

function progressKey(childId: string, lessonId: string): string {
  return `${childId}::${lessonId}`;
}

export async function loadProgress(
  childId: string,
  lessonId: string,
): Promise<Progress | undefined> {
  try {
    return await db.progress.where('[child_id+lesson_id]').equals([childId, lessonId]).first();
  } catch {
    return undefined;
  }
}

export async function saveProgress(
  childId: string,
  lessonId: string,
  stars: number,
  attempts: AttemptResult[],
): Promise<void> {
  const now = new Date().toISOString();
  const existing = await loadProgress(childId, lessonId);
  const id = existing?.id ?? progressKey(childId, lessonId);
  const previousAttempts = existing?.attempts_count ?? 0;
  const previousBest = existing?.best_score ?? null;
  const accuracyPool = attempts.filter(
    (a) => a.activityType === 'listen_tap' || a.activityType === 'word_builder',
  );
  const correct = accuracyPool.filter((a) => a.firstAttemptCorrect).length;
  const score = accuracyPool.length === 0 ? null : correct / accuracyPool.length;
  const nextBest =
    score === null
      ? previousBest
      : previousBest === null
        ? score
        : Math.max(previousBest, score);
  const status: Progress['status'] = stars >= 3 ? 'mastered' : stars >= 1 ? 'completed' : 'in_progress';

  const row: Progress = {
    id,
    child_id: childId,
    lesson_id: lessonId,
    status,
    stars,
    best_score: nextBest,
    attempts_count: previousAttempts + 1,
    last_attempt_at: now,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  await db.progress.put(row);
}

export async function getCurrentChild(): Promise<Child | undefined> {
  try {
    const all = await db.children.toArray();
    return all[0];
  } catch {
    return undefined;
  }
}

export async function getOrCreateGuestChild(): Promise<Child> {
  const existing = await getCurrentChild();
  if (existing) return existing;
  const now = new Date().toISOString();
  const guest: Child = {
    id: 'guest-child',
    parent_id: 'guest-parent',
    nickname: 'Explorer',
    avatar_key: null,
    age_band: '6-8',
    birth_year: null,
    created_at: now,
    updated_at: now,
  };
  try {
    await db.children.put(guest);
  } catch {
    // Storage may be unavailable (private browsing); in-memory return is fine.
  }
  return guest;
}
