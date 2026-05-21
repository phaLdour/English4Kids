// SAFETY INVARIANTS (do NOT change without Safety Officer sign-off):
// - No MediaRecorder. Only SpeechRecognition / whisper.wasm STT adapters
//   (invoked via `useMicSession()`) ever touch the microphone.
// - No Blob construction. No fetch POST with audio body. CSP connect-src is
//   Supabase only.
// - Mic audio stays on device — only `{ transcript, confidence }` leaves
//   the adapter; only `{ score, band }` leaves the scoring layer; only
//   numeric `score` and recognized `text` reach Supabase.
// - Auto-pass after 3 attempts regardless of score. Activity never blocks.
// - Never display raw score to the kid. Only band: "Great!" / "Good try!" /
//   "Let's listen together!". No banned phrasing.

'use client';

import {
  scorePronunciation,
  type AgeBand,
  type PhonemeMap,
  type PronunciationBand,
  type Strictness,
} from '@e4k/audio';
import type { ActivityItem, AudioAssetMap } from '@e4k/content-schema';
import { getSetting } from '@e4k/db';
import {
  EncouragementBanner,
  MicButton,
  type MascotReaction,
  type MicButtonState,
} from '@e4k/ui';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudio } from '@/lib/audio-client';
import { useMicSession } from '@/lib/use-mic-session';

type SpeakItItem = Extract<ActivityItem, { type: 'speak_it' }>;

export interface SpeakItProps {
  activity: { id: string; type: 'speak_it'; title: string; items: SpeakItItem[] };
  ageBand: AgeBand;
  audioMap: AudioAssetMap;
  phonemeMap: PhonemeMap;
  childId: string;
  onItemComplete: (result: { firstAttemptCorrect: boolean }) => void;
  onActivityComplete: () => void;
  onMascotChange?: (reaction: MascotReaction) => void;
}

const MAX_ATTEMPTS = 3;
const MAX_DURATION_MS = 1500;
const ADVANCE_AFTER_GREAT_MS = 1200;
const REPLAY_DELAY_MS = 400;

interface BandFeedback {
  banner: string;
  tone: 'celebrating' | 'gentle' | 'encouraging';
  mascot: MascotReaction;
}

function feedbackFor(
  band: PronunciationBand,
  encouragementSet: ReadonlyArray<string>,
  attemptCount: number,
  autoPassed: boolean,
): BandFeedback {
  if (autoPassed) {
    return {
      banner: "Let's keep going!",
      tone: 'celebrating',
      mascot: 'celebrating',
    };
  }
  if (band === 'great') {
    return {
      banner: encouragementSet[0] ?? 'You got it!',
      tone: 'celebrating',
      mascot: 'celebrating',
    };
  }
  if (band === 'good') {
    return {
      banner: encouragementSet[1] ?? 'Almost! Listen one more time.',
      tone: 'encouraging',
      mascot: 'gentle-hmm',
    };
  }
  // try-again band: third attempt was rough — keep banner gentle.
  const _ = attemptCount;
  return {
    banner: encouragementSet[2] ?? "Let's say it together.",
    tone: 'gentle',
    mascot: 'gentle-hmm',
  };
}

function filterItemsForBand(items: SpeakItItem[], ageBand: AgeBand): SpeakItItem[] {
  const matched = items.filter((it) => it.ageBand === ageBand);
  // If content doesn't declare a per-band variant for this band, fall back to
  // all items — never punish the lesson player for missing variants.
  return matched.length > 0 ? matched : items;
}

export function SpeakIt({
  activity,
  ageBand,
  audioMap,
  phonemeMap,
  childId,
  onItemComplete,
  onActivityComplete,
  onMascotChange,
}: SpeakItProps) {
  const t = useTranslations();
  const items = filterItemsForBand(activity.items, ageBand);
  const { playPrompt } = useAudio();
  const mic = useMicSession();

  const [itemIndex, setItemIndex] = useState(0);
  const [attemptCount, setAttemptCount] = useState(0);
  const [feedback, setFeedback] = useState<BandFeedback | null>(null);
  const [micEnabled, setMicEnabled] = useState<boolean | null>(null);
  const [shadowMode, setShadowMode] = useState<boolean>(false);
  const [strictness, setStrictness] = useState<Strictness>('normal');
  const firstAttemptBandRef = useRef<PronunciationBand | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const advancingRef = useRef<boolean>(false);

  // Childless prop placeholder — referenced so the linter sees it as used.
  // The downstream telemetry hook (sibling subagent) will read this when
  // persisting pronunciation_attempts; we don't persist here.
  void childId;

  const item = items[itemIndex];

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
  }, []);

  // Hydrate mic preferences once.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const enabled = await getSetting<boolean>('mic.enabled', false);
      const s = await getSetting<Strictness>('pronunciation.strictness', 'normal');
      if (cancelled) return;
      setMicEnabled(enabled);
      setStrictness(s);
      if (!enabled) setShadowMode(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reset per-item state when item changes. itemIndex is the intentional
  // trigger — we reset each time the player advances. The biome rule warns
  // about it being unused inside the body; that's fine, we use the change
  // detection only.
  // biome-ignore lint/correctness/useExhaustiveDependencies: itemIndex is the change-detection trigger
  useEffect(() => {
    setAttemptCount(0);
    setFeedback(null);
    firstAttemptBandRef.current = null;
    advancingRef.current = false;
  }, [itemIndex]);

  // Cleanup timers on unmount.
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  const playModel = useCallback(() => {
    if (!item) return;
    onMascotChange?.('listening');
    playPrompt(item.promptAudio, audioMap);
  }, [audioMap, item, onMascotChange, playPrompt]);

  // First-time auto-play of the model prompt per item.
  useEffect(() => {
    if (!item) return;
    if (micEnabled === null) return;
    playModel();
  }, [item, micEnabled, playModel]);

  const advance = useCallback(() => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    onMascotChange?.('idle');
    if (itemIndex + 1 >= items.length) {
      onActivityComplete();
    } else {
      setItemIndex((i) => i + 1);
    }
  }, [itemIndex, items.length, onActivityComplete, onMascotChange]);

  const finishItem = useCallback(
    (firstAttemptCorrect: boolean) => {
      onItemComplete({ firstAttemptCorrect });
      const t = setTimeout(() => advance(), ADVANCE_AFTER_GREAT_MS);
      timersRef.current.push(t);
    },
    [advance, onItemComplete],
  );

  // Shadow-mode (no mic) flow: play model twice, then auto-advance with a
  // first-attempt-correct=true (non-blocking).
  useEffect(() => {
    if (!shadowMode || !item || micEnabled === null) return;
    if (advancingRef.current) return;

    // We've already played once via the model auto-play effect. Schedule a
    // gentle replay and then advance.
    const replay = setTimeout(() => {
      playModel();
    }, 900);
    const done = setTimeout(() => {
      setFeedback({
        banner: "We're just listening today!",
        tone: 'celebrating',
        mascot: 'celebrating',
      });
      onMascotChange?.('celebrating');
      finishItem(true);
    }, 2400);
    timersRef.current.push(replay, done);
    return () => {
      clearTimeout(replay);
      clearTimeout(done);
    };
  }, [shadowMode, item, micEnabled, playModel, finishItem, onMascotChange]);

  const handleMicPress = useCallback(async () => {
    if (!item) return;
    if (mic.state === 'listening' || mic.state === 'processing') {
      mic.stop();
      return;
    }
    setFeedback(null);
    await mic.start({ maxDurationMs: MAX_DURATION_MS });
  }, [item, mic]);

  // React to a finished STT result.
  const lastProcessedRef = useRef<typeof mic.lastResult>(null);
  useEffect(() => {
    if (!item) return;
    if (!mic.lastResult) return;
    if (mic.lastResult === lastProcessedRef.current) return;
    lastProcessedRef.current = mic.lastResult;
    if (mic.state !== 'idle') return;

    const { transcript } = mic.lastResult;
    const { band } = scorePronunciation(item.targetUtterance, transcript, phonemeMap, {
      ageBand,
      strictness,
    });

    const nextAttempt = attemptCount + 1;
    setAttemptCount(nextAttempt);
    if (firstAttemptBandRef.current === null) {
      firstAttemptBandRef.current = band;
    }

    const reachedCap = nextAttempt >= MAX_ATTEMPTS;
    const autoPassed = reachedCap && band !== 'great';
    const fb = feedbackFor(band, item.encouragementSet, nextAttempt, autoPassed);
    setFeedback(fb);
    onMascotChange?.(fb.mascot);

    if (band === 'great' || autoPassed) {
      finishItem(firstAttemptBandRef.current === 'great');
      return;
    }

    // 'good' or 'try-again' with attempts remaining: replay the model and
    // let the kid try again.
    const replay = setTimeout(() => {
      playModel();
    }, REPLAY_DELAY_MS);
    timersRef.current.push(replay);
  }, [
    ageBand,
    attemptCount,
    finishItem,
    item,
    mic.lastResult,
    mic.state,
    onMascotChange,
    phonemeMap,
    playModel,
    strictness,
  ]);

  // Handle the rare case where the mic adapter goes into a hard error or
  // permission was revoked mid-activity. Fall back to shadow mode.
  useEffect(() => {
    if (mic.state === 'denied' && !shadowMode) {
      setShadowMode(true);
    }
  }, [mic.state, shadowMode]);

  const handleSkip = useCallback(() => {
    mic.stop();
    advance();
  }, [advance, mic]);

  if (!item || micEnabled === null) return null;

  const buttonState: MicButtonState =
    mic.state === 'listening'
      ? 'listening'
      : mic.state === 'processing' || mic.state === 'requesting-permission'
        ? 'processing'
        : 'idle';

  const buttonSize = ageBand === '6-8' ? 'young' : 'old';

  return (
    <section
      aria-label={t('activities.speakItAria')}
      className="flex w-full max-w-3xl flex-col items-center gap-[var(--space-6)]"
    >
      <div className="flex flex-col items-center gap-[var(--space-3)]">
        <h2
          className="text-center text-[2rem] text-[var(--color-primary-dark)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {item.targetUtterance}
        </h2>
        <p className="text-center text-base text-[var(--color-mist)]">
          {item.promptTranscript}
        </p>
      </div>

      <button
        type="button"
        onClick={() => playModel()}
        className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-[var(--space-6)] py-[var(--space-3)] text-[var(--color-surface-high)] shadow-[var(--shadow-pop)] transition-transform duration-[var(--motion-fast)] active:scale-95"
        style={{
          minHeight: 'var(--tap-min-young)',
          fontFamily: 'var(--font-display)',
          fontSize: '1.125rem',
        }}
        aria-label={t('activities.speakItListenAria')}
      >
        {t('activities.speakItListen')}
      </button>

      {feedback ? (
        <EncouragementBanner message={feedback.banner} tone={feedback.tone} />
      ) : null}

      {shadowMode ? (
        <p className="text-center text-sm text-[var(--color-mist)]">
          {t('activities.speakItShadowMode')}
        </p>
      ) : (
        <div className="flex flex-col items-center gap-[var(--space-3)]">
          <MicButton
            state={buttonState}
            size={buttonSize}
            label={buttonState === 'listening' ? t('activities.speakItListening') : t('activities.speakItTapAndSay')}
            onPress={() => void handleMicPress()}
          />
          <p className="text-sm text-[var(--color-mist)]">
            {t('activities.speakItAttemptsRemaining', { count: MAX_ATTEMPTS - attemptCount })}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={handleSkip}
        className="absolute bottom-[var(--space-4)] right-[var(--space-4)] rounded-[var(--radius-pill)] bg-[var(--color-surface-high)] px-[var(--space-4)] py-[var(--space-2)] text-sm text-[var(--color-ink)] shadow-[var(--shadow-card)] transition-transform duration-[var(--motion-fast)] active:scale-95"
        style={{
          minHeight: 'var(--tap-min-old)',
          minWidth: 'var(--tap-min-old)',
          fontFamily: 'var(--font-display)',
        }}
        aria-label={t('activities.speakItSkipAria')}
      >
        {t('common.skip')}
      </button>
    </section>
  );
}
