import type { Meta, StoryObj } from '@storybook/react';
import { EncouragementBanner, MicButton, type MicButtonState } from '@e4k/ui';
import { useTranslations } from 'next-intl';

/**
 * SpeakIt is an integrated activity that owns its own state machine
 * (`useMicSession` + `useAudio` + Dexie strictness/mic settings). Direct
 * module mocking from Storybook would require Vite config plumbing we don't
 * want to ship as part of S4-6.
 *
 * Instead, the stories below render a presentation-only fixture that mirrors
 * the visible SpeakIt UI (heading, "Listen" button, EncouragementBanner, and
 * the MicButton). Each story pins the visible state and the banner copy so
 * designers and PMs can review every result band without driving STT.
 *
 * When the audio team builds out the Vite mock layer for `useMicSession`,
 * these wrapper stories can be swapped for stories that mount the real
 * `<SpeakIt>` with the mocked hook.
 */

interface FixtureProps {
  targetUtterance: string;
  promptTranscript: string;
  banner?: { message: string; tone: 'celebrating' | 'gentle' | 'encouraging' };
  micState: MicButtonState;
  shadowMode?: boolean;
  attemptsRemaining?: number;
}

function SpeakItFixture({
  targetUtterance,
  promptTranscript,
  banner,
  micState,
  shadowMode = false,
  attemptsRemaining = 3,
}: FixtureProps) {
  const t = useTranslations();
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
          {targetUtterance}
        </h2>
        <p className="text-center text-base text-[var(--color-mist)]">{promptTranscript}</p>
      </div>

      <button
        type="button"
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

      {banner ? <EncouragementBanner message={banner.message} tone={banner.tone} /> : null}

      {shadowMode ? (
        <p className="text-center text-sm text-[var(--color-mist)]">
          {t('activities.speakItShadowMode')}
        </p>
      ) : (
        <div className="flex flex-col items-center gap-[var(--space-3)]">
          <MicButton
            state={micState}
            size="young"
            label={
              micState === 'listening'
                ? t('activities.speakItListening')
                : t('activities.speakItTapAndSay')
            }
          />
          <p className="text-sm text-[var(--color-mist)]">
            {t('activities.speakItAttemptsRemaining', { count: attemptsRemaining })}
          </p>
        </div>
      )}
    </section>
  );
}

const meta: Meta<typeof SpeakItFixture> = {
  title: 'Activities/SpeakIt',
  component: SpeakItFixture,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Presentation-only fixture for the SpeakIt activity. Mirrors the visible UI states (Idle, Listening, Result Great, Result Good, Result Try Again, Shadow Mode). The production `<SpeakIt>` component drives these states from `useMicSession` + scorePronunciation.',
      },
    },
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'aria-roles', enabled: true },
        ],
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof SpeakItFixture>;

export const Idle: Story = {
  args: {
    targetUtterance: 'Hello, my name is Mila.',
    promptTranscript: 'Press Talk and say it out loud.',
    micState: 'idle',
    attemptsRemaining: 3,
  },
};

export const Listening: Story = {
  args: {
    targetUtterance: 'Hello, my name is Mila.',
    promptTranscript: 'Listening... tap to stop.',
    micState: 'listening',
    attemptsRemaining: 3,
  },
};

export const ResultGreat: Story = {
  args: {
    targetUtterance: 'Hello, my name is Mila.',
    promptTranscript: '',
    banner: { message: 'You got it!', tone: 'celebrating' },
    micState: 'idle',
    attemptsRemaining: 2,
  },
  parameters: {
    docs: {
      description: { story: 'Great band: celebration banner, mascot fires celebrating reaction.' },
    },
  },
};

export const ResultGood: Story = {
  args: {
    targetUtterance: 'Hello, my name is Mila.',
    promptTranscript: '',
    banner: { message: 'Almost! Listen one more time.', tone: 'encouraging' },
    micState: 'idle',
    attemptsRemaining: 2,
  },
  parameters: {
    docs: {
      description: { story: 'Good band: gentle encouragement, model replays automatically.' },
    },
  },
};

export const ResultTryAgain: Story = {
  args: {
    targetUtterance: 'Hello, my name is Mila.',
    promptTranscript: '',
    banner: { message: "Let's say it together.", tone: 'gentle' },
    micState: 'idle',
    attemptsRemaining: 1,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Try-again band: warmest copy. After the third attempt the activity auto-passes regardless of band.',
      },
    },
  },
};

export const MicDisabledFallback: Story = {
  args: {
    targetUtterance: 'Hello, my name is Mila.',
    promptTranscript: 'We will just listen today.',
    micState: 'disabled',
    shadowMode: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'When the parent has not enabled the mic, SpeakIt falls back to shadow mode: the model plays twice and the lesson advances with `firstAttemptCorrect: true` (non-blocking).',
      },
    },
  },
};
