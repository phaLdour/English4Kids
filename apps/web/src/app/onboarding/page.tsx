'use client';

import { AudioUnlock } from '@e4k/audio';
import { db, setSetting } from '@e4k/db';
import { ProgressDots, VolumeSlider } from '@e4k/ui';
import * as RadioGroup from '@radix-ui/react-radio-group';
import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { getAudioClient } from '@/lib/audio-client';

/** Best-effort volume update on the singleton AudioPlayer. */
async function applyVolume(
  channel: 'master' | 'music' | 'sfx' | 'voice',
  value: number,
): Promise<void> {
  try {
    const player = await getAudioClient();
    player.setVolume(channel, value);
  } catch {
    // Howler may not initialise in jsdom / SSR. Silent fallback is fine —
    // the value is persisted to Dexie either way.
  }
}

type Step = 'unlock' | 'buddy' | 'age' | 'nickname' | 'audio' | 'mic' | 'done';
type AgeBand = '6-8' | '9-12';

const STEP_ORDER: Step[] = ['unlock', 'buddy', 'age', 'nickname', 'audio', 'mic', 'done'];
const VISIBLE_STEPS = STEP_ORDER.length - 1; // 'done' is a transient finish state

const PRIMARY_NICKNAMES = [
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

const SECONDARY_NICKNAMES = [
  'Joyful Jay',
  'Merry Mouse',
  'Lucky Lamb',
  'Bright Badger',
  'Witty Whale',
  'Calm Camel',
] as const;

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // RFC4122-ish fallback for environments lacking crypto.randomUUID (rare in
  // modern browsers, but jsdom historically missing it).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function speak(text: string): void {
  if (typeof window === 'undefined') return;
  if (typeof window.speechSynthesis === 'undefined') return;
  try {
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  } catch {
    // Web Speech absent or blocked — silent fallback. Captions cover the copy.
  }
}

function StepFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-[var(--space-6)] px-[var(--space-4)]">
      {children}
    </div>
  );
}

function PrimaryButton({
  onClick,
  children,
  type = 'button',
  ariaLabel,
}: {
  onClick: () => void;
  children: ReactNode;
  type?: 'button' | 'submit';
  ariaLabel?: string;
}) {
  return (
    <button
      type={type}
      aria-label={ariaLabel}
      onClick={onClick}
      className="flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-[var(--space-10)] py-[var(--space-4)] text-[var(--color-surface-high)] shadow-[var(--shadow-pop)] transition-transform duration-[var(--motion-fast)] active:scale-[0.98]"
      style={{
        minHeight: 'var(--tap-primary-young)',
        minWidth: 'var(--tap-primary-young)',
        fontFamily: 'var(--font-display)',
        fontSize: '1.25rem',
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-surface-high)] px-[var(--space-6)] py-[var(--space-3)] text-[var(--color-ink)] shadow-[var(--shadow-card)] transition-transform duration-[var(--motion-fast)] active:scale-[0.98]"
      style={{
        minHeight: 'var(--tap-min-young)',
        fontFamily: 'var(--font-display)',
        fontSize: '1rem',
      }}
    >
      {children}
    </button>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('unlock');
  const [ageBand, setAgeBand] = useState<AgeBand>('6-8');
  const [nickname, setNickname] = useState<string>('');
  const [nicknameList, setNicknameList] = useState<readonly string[]>(PRIMARY_NICKNAMES);
  const [audioMaster, setAudioMaster] = useState<number>(80);

  const visibleIndex = useMemo(() => {
    const idx = STEP_ORDER.indexOf(step);
    return Math.min(idx, VISIBLE_STEPS - 1);
  }, [step]);

  const goTo = useCallback((next: Step) => setStep(next), []);

  const goBack = useCallback(() => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx <= 0) return;
    const prev = STEP_ORDER[idx - 1];
    if (prev) setStep(prev);
  }, [step]);

  // Step 1: AudioUnlock.
  const handleUnlock = useCallback(async () => {
    await AudioUnlock.unlock();
    // Prime Howler too — best-effort.
    try {
      await getAudioClient();
    } catch {
      // ignore
    }
    goTo('buddy');
  }, [goTo]);

  // Step 2: Pick Milo.
  const handlePickMilo = useCallback(async () => {
    await setSetting('mascot.choice', 'milo');
    goTo('age');
  }, [goTo]);

  // Step 3: Age band.
  const handlePickAge = useCallback(async () => {
    await setSetting('age.band', ageBand);
    // Derived default for captions: ON for 6-8.
    await setSetting('captions.enabled', ageBand === '6-8');
    goTo('nickname');
  }, [ageBand, goTo]);

  // Step 4: Nickname.
  const handlePickNickname = useCallback(async () => {
    if (!nickname) return;
    const childId = generateUuid();
    const avatarKey = nickname.toLowerCase().replace(/\s+/g, '-');
    await setSetting('child.nickname', nickname);
    await setSetting('child.avatarKey', avatarKey);
    try {
      // Local-first child row. parent_id is empty for anonymous play; the sync
      // outbox / Supabase reconciliation will fill it on first parent upgrade.
      const now = new Date().toISOString();
      await db.children.put({
        id: childId,
        parent_id: '',
        nickname,
        avatar_key: avatarKey,
        age_band: ageBand,
        birth_year: null,
        created_at: now,
        updated_at: now,
      });
    } catch {
      // Dexie can fail in private mode; setting-key copies still carry the
      // nickname forward so onboarding remains valid.
    }
    goTo('audio');
  }, [nickname, ageBand, goTo]);

  const refreshNicknames = useCallback(() => {
    // Pull 6 from the secondary set + 6 from the primary set; deterministic
    // composition so the user always sees a familiar nickname alongside fresh
    // options.
    const merged = [...SECONDARY_NICKNAMES, ...PRIMARY_NICKNAMES.slice(0, 6)];
    setNicknameList(merged);
  }, []);

  // Step 5: Audio primer.
  const handleAudioVolumeChange = useCallback((v: number) => {
    setAudioMaster(v);
    void applyVolume('master', v);
  }, []);

  const handleAudioConfirm = useCallback(async () => {
    await setSetting('audio.master', audioMaster);
    speak("Sounds good! Let's check your microphone.");
    goTo('mic');
  }, [audioMaster, goTo]);

  // Step 6: Mic primer (informational only).
  const handleMicAck = useCallback(() => {
    goTo('done');
  }, [goTo]);

  // Step 7: Done — set flag, route to /play.
  const handleFinish = useCallback(async () => {
    await setSetting('onboarding.complete', true);
    router.replace('/play');
  }, [router]);

  return (
    <main className="flex min-h-dvh flex-col items-center bg-[var(--color-surface)] py-[var(--space-8)]">
      <header className="flex w-full max-w-xl items-center justify-between gap-[var(--space-3)] px-[var(--space-4)]">
        {step === 'unlock' ? (
          <span className="h-12 w-24" aria-hidden="true" />
        ) : (
          <SecondaryButton onClick={goBack}>Back</SecondaryButton>
        )}
        <ProgressDots
          total={VISIBLE_STEPS}
          current={visibleIndex}
          label="Setup progress"
        />
        <span className="h-12 w-24" aria-hidden="true" />
      </header>

      <div className="mt-[var(--space-10)] flex flex-1 w-full flex-col items-center justify-center gap-[var(--space-8)]">
        {step === 'unlock' ? (
          <StepFrame>
            <div
              aria-hidden="true"
              className="flex h-40 w-40 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--color-milo)] text-[var(--color-surface-high)] shadow-[var(--shadow-milo)]"
              style={{ fontFamily: 'var(--font-display)', fontSize: '2rem' }}
            >
              Milo
            </div>
            <h1
              className="text-center text-3xl text-[var(--color-primary-dark)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Hi! Tap to begin.
            </h1>
            <PrimaryButton onClick={() => void handleUnlock()} ariaLabel="Tap to begin">
              Tap to begin
            </PrimaryButton>
          </StepFrame>
        ) : null}

        {step === 'buddy' ? (
          <StepFrame>
            <h1
              className="text-center text-3xl text-[var(--color-primary-dark)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Choose your buddy
            </h1>
            <button
              type="button"
              onClick={() => speak("Hi! I'm Milo.")}
              className="flex flex-col items-center gap-[var(--space-3)] rounded-[var(--radius-xl)] bg-[var(--color-surface-high)] p-[var(--space-6)] shadow-[var(--shadow-pop)]"
              aria-label="Hear Milo say hello"
            >
              <span
                aria-hidden="true"
                className="flex h-32 w-32 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--color-milo)] text-[var(--color-surface-high)] shadow-[var(--shadow-milo)]"
                style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem' }}
              >
                Milo
              </span>
              <span
                className="text-xl text-[var(--color-ink)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Hi! I&rsquo;m Milo.
              </span>
              <span className="text-sm text-[var(--color-mist)]">Tap me to say hello.</span>
            </button>
            <PrimaryButton onClick={() => void handlePickMilo()}>Pick Milo</PrimaryButton>
          </StepFrame>
        ) : null}

        {step === 'age' ? (
          <StepFrame>
            <h1
              className="text-center text-3xl text-[var(--color-primary-dark)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              How old is your learner?
            </h1>
            <p className="max-w-prose text-center text-[var(--color-ink)]">
              This helps us choose the right reading level and pace.
            </p>
            <RadioGroup.Root
              value={ageBand}
              onValueChange={(v) => setAgeBand(v as AgeBand)}
              className="flex w-full flex-col gap-[var(--space-3)]"
              aria-label="Age band"
            >
              <RadioGroup.Item
                value="6-8"
                className="flex w-full items-center gap-[var(--space-4)] rounded-[var(--radius-lg)] bg-[var(--color-surface-high)] p-[var(--space-5)] shadow-[var(--shadow-card)] data-[state=checked]:ring-4 data-[state=checked]:ring-[var(--color-primary)]"
                style={{ minHeight: 'var(--tap-primary-young)' }}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-pill)] border-2 border-[var(--color-primary)]">
                  <RadioGroup.Indicator className="block h-4 w-4 rounded-[var(--radius-pill)] bg-[var(--color-primary)]" />
                </span>
                <span className="flex flex-col text-left">
                  <span
                    className="text-xl text-[var(--color-ink)]"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    6 to 8 (Lower)
                  </span>
                  <span className="text-sm text-[var(--color-mist)]">
                    Bigger buttons, captions on, slower narration.
                  </span>
                </span>
              </RadioGroup.Item>
              <RadioGroup.Item
                value="9-12"
                className="flex w-full items-center gap-[var(--space-4)] rounded-[var(--radius-lg)] bg-[var(--color-surface-high)] p-[var(--space-5)] shadow-[var(--shadow-card)] data-[state=checked]:ring-4 data-[state=checked]:ring-[var(--color-primary)]"
                style={{ minHeight: 'var(--tap-primary-young)' }}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-pill)] border-2 border-[var(--color-primary)]">
                  <RadioGroup.Indicator className="block h-4 w-4 rounded-[var(--radius-pill)] bg-[var(--color-primary)]" />
                </span>
                <span className="flex flex-col text-left">
                  <span
                    className="text-xl text-[var(--color-ink)]"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    9 to 12 (Upper)
                  </span>
                  <span className="text-sm text-[var(--color-mist)]">
                    Compact layout, richer text, normal narration.
                  </span>
                </span>
              </RadioGroup.Item>
            </RadioGroup.Root>
            <PrimaryButton onClick={() => void handlePickAge()}>Continue</PrimaryButton>
          </StepFrame>
        ) : null}

        {step === 'nickname' ? (
          <StepFrame>
            <h1
              className="text-center text-3xl text-[var(--color-primary-dark)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Pick a nickname
            </h1>
            <p className="max-w-prose text-center text-[var(--color-ink)]">
              Pick a fun animal name. You can change it later.
            </p>
            <RadioGroup.Root
              value={nickname}
              onValueChange={(v) => setNickname(v)}
              className="grid w-full grid-cols-2 gap-[var(--space-3)]"
              aria-label="Nickname"
            >
              {nicknameList.map((name) => (
                <RadioGroup.Item
                  key={name}
                  value={name}
                  className="flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-4)] text-center shadow-[var(--shadow-card)] data-[state=checked]:ring-4 data-[state=checked]:ring-[var(--color-primary)]"
                  style={{ minHeight: 'var(--tap-min-young)' }}
                >
                  <span
                    className="text-base text-[var(--color-ink)]"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {name}
                  </span>
                </RadioGroup.Item>
              ))}
            </RadioGroup.Root>
            <SecondaryButton onClick={refreshNicknames}>Refresh for more</SecondaryButton>
            <PrimaryButton onClick={() => void handlePickNickname()}>Continue</PrimaryButton>
          </StepFrame>
        ) : null}

        {step === 'audio' ? (
          <StepFrame>
            <h1
              className="text-center text-3xl text-[var(--color-primary-dark)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Let&rsquo;s check your sound!
            </h1>
            <button
              type="button"
              onClick={() => speak("Let's check your sound!")}
              className="flex flex-col items-center gap-[var(--space-3)] rounded-[var(--radius-xl)] bg-[var(--color-surface-high)] p-[var(--space-5)] shadow-[var(--shadow-pop)]"
              aria-label="Hear Milo speak again"
            >
              <span
                aria-hidden="true"
                className="flex h-24 w-24 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--color-milo)] text-[var(--color-surface-high)] shadow-[var(--shadow-milo)]"
                style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem' }}
              >
                Milo
              </span>
              <span className="text-sm text-[var(--color-mist)]">Tap to hear again.</span>
            </button>
            <div className="w-full rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-5)] shadow-[var(--shadow-card)]">
              <VolumeSlider
                label="Master volume"
                value={audioMaster}
                onChange={handleAudioVolumeChange}
              />
            </div>
            <PrimaryButton onClick={() => void handleAudioConfirm()}>Sounds good!</PrimaryButton>
          </StepFrame>
        ) : null}

        {step === 'mic' ? (
          <StepFrame>
            <h1
              className="text-center text-3xl text-[var(--color-primary-dark)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              About the microphone
            </h1>
            <p className="max-w-prose text-center text-lg text-[var(--color-ink)]">
              We&rsquo;ll ask permission to use your microphone when we get to speaking
              practice. Your voice never leaves your device.
            </p>
            <PrimaryButton onClick={handleMicAck}>Got it</PrimaryButton>
          </StepFrame>
        ) : null}

        {step === 'done' ? (
          <StepFrame>
            <div
              aria-hidden="true"
              className="flex h-40 w-40 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--color-milo)] text-[var(--color-surface-high)] shadow-[var(--shadow-milo)]"
              style={{ fontFamily: 'var(--font-display)', fontSize: '2rem' }}
            >
              Milo
            </div>
            <h1
              className="text-center text-3xl text-[var(--color-primary-dark)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              All set! Let&rsquo;s go!
            </h1>
            <PrimaryButton onClick={() => void handleFinish()}>Start playing</PrimaryButton>
          </StepFrame>
        ) : null}
      </div>
    </main>
  );
}
