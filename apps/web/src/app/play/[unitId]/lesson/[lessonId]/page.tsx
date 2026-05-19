'use client';

import {
  EncouragementBanner,
  MascotFrame,
  ProgressDots,
  StarReveal,
  TopBar,
  type MascotReaction,
  type StarCount,
} from '@e4k/ui';
import type {
  Activity,
  ActivityItem,
  AudioAssetMap,
  Lesson,
  Unit,
} from '@e4k/content-schema';
import {
  type ActivityKind,
  type AttemptResult,
  type StarCount as EngineStarCount,
  type StreakState,
  calculateStars,
  initialStreak,
  recordActivity,
} from '@e4k/game-engine';
import { getSetting, setSetting } from '@e4k/db';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ListenAndTap } from '@/components/activities/ListenAndTap';
import { SingAlong } from '@/components/activities/SingAlong';
import { SpeakIt } from '@/components/activities/SpeakIt';
import { StoryTime } from '@/components/activities/StoryTime';
import { TprBreak } from '@/components/activities/TprBreak';
import { WordBuilder } from '@/components/activities/WordBuilder';
import { activityMessages } from '@/components/activities/messages';
import { resolveImage } from '@/lib/image-resolver';
import {
  getOrCreateGuestChild,
  loadAudioMap,
  loadProgress,
  saveProgress,
} from '@/lib/lesson-player';
import { isShineReplay } from '@/lib/replay-detection';
import { useVocabState } from '@/lib/use-vocab-state';

type PhonemeMap = Record<string, string[]>;

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready';
      unit: Unit;
      lesson: Lesson;
      audioMap: AudioAssetMap;
      phonemeMap: PhonemeMap;
    };

type PlayerPhase = 'activity' | 'tpr_break' | 'complete';

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function LessonPlayerPage() {
  const router = useRouter();
  const params = useParams<{ unitId: string; lessonId: string }>();
  const unitId = Array.isArray(params.unitId) ? params.unitId[0] : params.unitId;
  const lessonId = Array.isArray(params.lessonId) ? params.lessonId[0] : params.lessonId;

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [ageBand, setAgeBand] = useState<'6-8' | '9-12'>('6-8');
  const [activityIndex, setActivityIndex] = useState(0);
  const [phase, setPhase] = useState<PlayerPhase>('activity');
  const [attempts, setAttempts] = useState<AttemptResult[]>([]);
  const [stars, setStars] = useState<StarCount | null>(null);
  const [mascotReaction, setMascotReaction] = useState<MascotReaction>('idle');
  const [banner, setBanner] = useState<string | null>(null);
  const [childId, setChildId] = useState<string | null>(null);
  const [priorStars, setPriorStars] = useState<number>(0);
  const [wasReplay, setWasReplay] = useState<boolean>(false);
  const { recordOutcome } = useVocabState(childId);
  const recordOutcomeRef = useRef(recordOutcome);
  const itemCounterRef = useRef<number>(0);

  useEffect(() => {
    recordOutcomeRef.current = recordOutcome;
  }, [recordOutcome]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [unitRes, audioMap, phonemeRes, band, child] = await Promise.all([
          fetch(`/api/content/${encodeURIComponent(unitId)}`),
          loadAudioMap(unitId),
          fetch(`/api/content/${encodeURIComponent(unitId)}/phonemes`).catch(
            () => null,
          ),
          getSetting<'6-8' | '9-12'>('age.band', '6-8'),
          getOrCreateGuestChild(),
        ]);
        if (cancelled) return;
        if (!unitRes.ok) {
          setState({ kind: 'error', message: 'Lesson is on the way.' });
          return;
        }
        const unit = (await unitRes.json()) as Unit;
        const lesson = unit.lessons.find((l) => l.id === lessonId);
        if (!lesson) {
          setState({ kind: 'error', message: 'Lesson not found.' });
          return;
        }
        let phonemeMap: PhonemeMap = {};
        if (phonemeRes && phonemeRes.ok) {
          try {
            phonemeMap = (await phonemeRes.json()) as PhonemeMap;
          } catch {
            phonemeMap = {};
          }
        }
        setAgeBand(band);
        setChildId(child.id);
        try {
          const prev = await loadProgress(child.id, lesson.id);
          if (prev && !cancelled) setPriorStars(prev.stars ?? 0);
        } catch {
          // ignore — fresh learner
        }
        setState({ kind: 'ready', unit, lesson, audioMap, phonemeMap });
      } catch {
        if (!cancelled) setState({ kind: 'error', message: 'Could not load lesson.' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [unitId, lessonId]);

  const lesson = state.kind === 'ready' ? state.lesson : null;
  const audioMap = state.kind === 'ready' ? state.audioMap : ({} as AudioAssetMap);
  const phonemeMap: PhonemeMap = state.kind === 'ready' ? state.phonemeMap : {};
  const activities: Activity[] = lesson?.activities ?? [];
  const currentActivity = activities[activityIndex];

  const itemsByType = useMemo(() => {
    if (!currentActivity) return null;
    return groupItemsByType(currentActivity.items);
  }, [currentActivity]);

  const handleItemComplete = useCallback(
    (
      activityType: ActivityKind,
      result: { firstAttemptCorrect: boolean },
      word?: string,
    ) => {
      setAttempts((prev) => [
        ...prev,
        {
          activityType,
          firstAttemptCorrect: result.firstAttemptCorrect,
          attempted: true,
        },
      ]);
      if (result.firstAttemptCorrect) {
        const messages = activityMessages.encouragement;
        const choice = messages[Math.floor(Math.random() * messages.length)] ?? messages[0];
        setBanner(choice);
      }
      // Record vocab outcome for items that map cleanly to a single word.
      if (
        word &&
        (activityType === 'listen_tap' || activityType === 'word_builder')
      ) {
        void recordOutcomeRef.current(
          word,
          result.firstAttemptCorrect ? 'correct' : 'incorrect',
        );
      }
    },
    [],
  );

  const finishLesson = useCallback(
    async (finalAttempts: AttemptResult[]) => {
      const computed: EngineStarCount = calculateStars(finalAttempts);
      const finalStars = (computed === 0 ? 1 : computed) as StarCount;
      const replay = isShineReplay(priorStars, finalStars);
      setWasReplay(replay.isReplay);
      setStars(finalStars);
      setPhase('complete');
      if (childId && lesson) {
        try {
          await saveProgress(childId, lesson.id, finalStars, finalAttempts);
        } catch {
          // Storage may be unavailable; lesson UI still completes.
        }
        try {
          const prior = await getSetting<StreakState>('streak.state', initialStreak());
          const next = recordActivity({
            state: prior,
            todayLocalDay: isoToday(),
          });
          await setSetting('streak.state', next);
        } catch {
          // streak persistence is best-effort.
        }
      }
    },
    [childId, lesson, priorStars],
  );

  const handleActivityComplete = useCallback(() => {
    if (!lesson) return;
    setBanner(null);
    const tpr = lesson.tprBreak;
    const isLast = activityIndex >= activities.length - 1;
    if (!isLast && tpr && tpr.afterActivityIndex === activityIndex) {
      setPhase('tpr_break');
      return;
    }
    if (isLast) {
      setAttempts((prev) => {
        void finishLesson(prev);
        return prev;
      });
      return;
    }
    setActivityIndex((i) => i + 1);
  }, [activityIndex, activities.length, finishLesson, lesson]);

  const handleTprComplete = useCallback(() => {
    setPhase('activity');
    setActivityIndex((i) => i + 1);
  }, []);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 1500);
    return () => clearTimeout(t);
  }, [banner]);

  if (state.kind === 'loading') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[var(--color-surface)] px-[var(--space-4)]">
        <p className="text-xl text-[var(--color-ink)]" aria-live="polite">
          Loading lesson…
        </p>
      </main>
    );
  }

  if (state.kind === 'error') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-[var(--space-4)] bg-[var(--color-surface)] px-[var(--space-4)]">
        <p className="text-xl text-[var(--color-ink)]">{state.message}</p>
        <button
          type="button"
          onClick={() => router.push(`/play/${unitId}`)}
          className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-[var(--space-6)] py-[var(--space-3)] text-[var(--color-surface-high)] shadow-[var(--shadow-pop)]"
          style={{ fontFamily: 'var(--font-display)', minHeight: 'var(--tap-min-young)' }}
        >
          Back to unit
        </button>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col bg-[var(--color-surface)]">
      <TopBar
        title={lesson?.title}
        onBack={() => router.push(`/play/${unitId}`)}
        onOpenSettings={() => router.push('/settings')}
      />
      <div className="flex w-full flex-col items-center gap-[var(--space-4)] px-[var(--space-4)] py-[var(--space-4)]">
        <ProgressDots total={activities.length} current={activityIndex} />
      </div>
      <section className="flex flex-1 flex-col items-center justify-center gap-[var(--space-6)] px-[var(--space-4)] py-[var(--space-6)]">
        {banner ? <EncouragementBanner message={banner} tone="celebrating" /> : null}
        {phase === 'tpr_break' && lesson?.tprBreak ? (
          <TprBreak
            promptText={lesson.tprBreak.promptText}
            durationSec={lesson.tprBreak.durationSec}
            onComplete={handleTprComplete}
          />
        ) : null}
        {phase === 'activity' && currentActivity && itemsByType ? (
          <ActivityRenderer
            activity={currentActivity}
            items={itemsByType}
            ageBand={ageBand}
            audioMap={audioMap}
            phonemeMap={phonemeMap}
            childId={childId ?? 'guest-child'}
            onItemComplete={(result) => {
              const activityKind = currentActivity.type as ActivityKind;
              const word = inferWordForItem(
                currentActivity,
                itemCounterRef.current,
                lesson?.vocabRefs ?? [],
              );
              itemCounterRef.current += 1;
              handleItemComplete(activityKind, result, word);
            }}
            onActivityComplete={() => {
              itemCounterRef.current = 0;
              handleActivityComplete();
            }}
            onMascotChange={setMascotReaction}
          />
        ) : null}
        {phase === 'complete' && stars !== null ? (
          <div className="flex flex-col items-center gap-[var(--space-6)]">
            <StarReveal count={stars as 1 | 2 | 3} wasReplay={wasReplay} />
            <div className="flex flex-wrap items-center justify-center gap-[var(--space-3)]">
              <ActionButton
                label="Replay"
                onClick={() => {
                  setPriorStars(stars ?? priorStars);
                  setWasReplay(false);
                  setAttempts([]);
                  setStars(null);
                  setActivityIndex(0);
                  itemCounterRef.current = 0;
                  setPhase('activity');
                }}
              />
              <ActionButton
                label="Next lesson"
                onClick={() => {
                  const next = nextLessonId(state.unit, lessonId);
                  if (next) {
                    router.push(`/play/${unitId}/lesson/${next}`);
                  } else {
                    router.push(`/play/${unitId}`);
                  }
                }}
              />
              <ActionButton label="Home" onClick={() => router.push('/play')} />
            </div>
          </div>
        ) : null}
      </section>
      <MascotFrame variant="milo" reaction={mascotReaction} />
    </main>
  );
}

interface ActivityRendererProps {
  activity: Activity;
  items: ReturnType<typeof groupItemsByType>;
  ageBand: '6-8' | '9-12';
  audioMap: AudioAssetMap;
  phonemeMap: PhonemeMap;
  childId: string;
  onItemComplete: (result: { firstAttemptCorrect: boolean }) => void;
  onActivityComplete: () => void;
  onMascotChange: (reaction: MascotReaction) => void;
}

function ActivityRenderer({
  activity,
  items,
  ageBand,
  audioMap,
  phonemeMap,
  childId,
  onItemComplete,
  onActivityComplete,
  onMascotChange,
}: ActivityRendererProps) {
  if (activity.type === 'listen_tap' && items.listen_tap.length > 0) {
    return (
      <ListenAndTap
        items={items.listen_tap}
        ageBand={ageBand}
        audioMap={audioMap}
        onItemComplete={onItemComplete}
        onActivityComplete={onActivityComplete}
        onMascotChange={onMascotChange}
        imageResolver={resolveImage}
      />
    );
  }
  if (activity.type === 'word_builder' && items.word_builder.length > 0) {
    return (
      <WordBuilder
        items={items.word_builder}
        ageBand={ageBand}
        audioMap={audioMap}
        onItemComplete={onItemComplete}
        onActivityComplete={onActivityComplete}
        onMascotChange={onMascotChange}
        imageResolver={resolveImage}
      />
    );
  }
  if (activity.type === 'story_time' && items.story_time.length > 0) {
    return (
      <StoryTime
        items={items.story_time}
        ageBand={ageBand}
        audioMap={audioMap}
        onItemComplete={onItemComplete}
        onActivityComplete={onActivityComplete}
        onMascotChange={onMascotChange}
        imageResolver={resolveImage}
      />
    );
  }
  if (activity.type === 'sing_along' && items.sing_along.length > 0) {
    return (
      <SingAlong
        items={items.sing_along}
        ageBand={ageBand}
        audioMap={audioMap}
        onItemComplete={onItemComplete}
        onActivityComplete={onActivityComplete}
        onMascotChange={onMascotChange}
      />
    );
  }
  if (activity.type === 'speak_it' && items.speak_it.length > 0) {
    return (
      <SpeakIt
        activity={{
          id: activity.id,
          type: 'speak_it',
          title: activity.title,
          items: items.speak_it,
        }}
        ageBand={ageBand}
        audioMap={audioMap}
        phonemeMap={phonemeMap}
        childId={childId}
        onItemComplete={onItemComplete}
        onActivityComplete={onActivityComplete}
        onMascotChange={onMascotChange}
      />
    );
  }
  return (
    <ActionButton label="Continue" onClick={onActivityComplete} />
  );
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-[var(--space-6)] py-[var(--space-3)] text-[var(--color-surface-high)] shadow-[var(--shadow-pop)] transition-transform duration-[var(--motion-fast)] active:scale-95"
      style={{
        minHeight: 'var(--tap-primary-young)',
        fontFamily: 'var(--font-display)',
        fontSize: '1.125rem',
      }}
    >
      {label}
    </button>
  );
}

interface GroupedItems {
  listen_tap: Extract<ActivityItem, { type: 'listen_tap' }>[];
  word_builder: Extract<ActivityItem, { type: 'word_builder' }>[];
  story_time: Extract<ActivityItem, { type: 'story_time' }>[];
  sing_along: Extract<ActivityItem, { type: 'sing_along' }>[];
  speak_it: Extract<ActivityItem, { type: 'speak_it' }>[];
}

function groupItemsByType(items: ActivityItem[]): GroupedItems {
  const out: GroupedItems = {
    listen_tap: [],
    word_builder: [],
    story_time: [],
    sing_along: [],
    speak_it: [],
  };
  for (const item of items) {
    if (item.type === 'listen_tap') out.listen_tap.push(item);
    else if (item.type === 'word_builder') out.word_builder.push(item);
    else if (item.type === 'story_time') out.story_time.push(item);
    else if (item.type === 'sing_along') out.sing_along.push(item);
    else if (item.type === 'speak_it') out.speak_it.push(item);
  }
  return out;
}

function nextLessonId(unit: Unit, currentLessonId: string): string | null {
  const idx = unit.lessons.findIndex((l) => l.id === currentLessonId);
  if (idx === -1) return null;
  const next = unit.lessons[idx + 1];
  return next?.id ?? null;
}

/**
 * Best-effort mapping from a completed item back to a single vocab word.
 *
 * - `word_builder`: read `targetWord` directly from the item at the matching index.
 * - `listen_tap`: fall back to `lesson.vocabRefs[index]` (matching authoring
 *   convention that items are ordered by vocab).
 * - Other activity types do not carry a clean per-item word and return `undefined`.
 */
function inferWordForItem(
  activity: Activity,
  itemIndex: number,
  vocabRefs: string[],
): string | undefined {
  const item = activity.items[itemIndex];
  if (!item) return undefined;
  if (item.type === 'word_builder') {
    return item.targetWord;
  }
  if (item.type === 'listen_tap') {
    const ref = vocabRefs[itemIndex];
    if (!ref) return undefined;
    // ref looks like "vocab.hello" — strip the "vocab." prefix.
    return ref.replace(/^vocab\./, '');
  }
  return undefined;
}
