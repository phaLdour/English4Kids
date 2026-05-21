'use client';

import { getSetting, setSetting, type MicEngine } from '@e4k/db';
import { ParentGate, ToggleRow, TopBar, VolumeSlider } from '@e4k/ui';
import * as RadioGroup from '@radix-ui/react-radio-group';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useId, useState } from 'react';
import { getAudioClient } from '@/lib/audio-client';
import {
  DEFAULT_LOCALE,
  type Locale,
  notifyLocaleChanged,
  SUPPORTED_LOCALES,
} from '@/lib/i18n-provider';
import { applySettingsToDom } from '@/lib/settings-effects';
import {
  loadWhisper,
  type WhisperLoadProgress,
} from '@/lib/whisper-loader';

/** Best-effort volume update — silent if audio isn't available. */
async function applyVolume(
  channel: 'master' | 'music' | 'sfx' | 'voice',
  value: number,
): Promise<void> {
  try {
    const p = await getAudioClient();
    p.setVolume(channel, value);
  } catch {
    // Audio not available in this environment.
  }
}

/** Best-effort mute application. */
async function applyMute(muted: boolean): Promise<void> {
  try {
    const p = await getAudioClient();
    if (p.getConfig().muteAll !== muted) p.toggleMute();
  } catch {
    // ignore
  }
}

/** Best-effort focus-mode application. */
async function applyFocusMode(enabled: boolean): Promise<void> {
  try {
    const p = await getAudioClient();
    p.setFocusMode(enabled);
  } catch {
    // ignore
  }
}

type NarrationSpeed = 'slow' | 'normal' | 'fast';
type AgeBand = '6-8' | '9-12';

type MascotChoice = 'milo' | 'luna' | 'both';

interface SettingsState {
  audioMaster: number;
  audioMusic: number;
  audioSfx: number;
  audioVoice: number;
  muted: boolean;
  focusMode: boolean;
  mascotChoice: MascotChoice;
  narrationSpeed: NarrationSpeed;
  captionsEnabled: boolean;
  autoplaySongs: boolean;
  micEnabled: boolean;
  micEngine: MicEngine;
  fontDyslexia: boolean;
  motionReduced: boolean;
  contrastHigh: boolean;
  ageBand: AgeBand;
  locale: Locale;
}

const DEFAULT_SETTINGS: SettingsState = {
  audioMaster: 80,
  audioMusic: 60,
  audioSfx: 80,
  audioVoice: 100,
  muted: false,
  focusMode: false,
  mascotChoice: 'milo',
  narrationSpeed: 'normal',
  captionsEnabled: true,
  autoplaySongs: true,
  micEnabled: false,
  micEngine: 'web-speech',
  fontDyslexia: false,
  motionReduced: false,
  contrastHigh: false,
  ageBand: '6-8',
  locale: DEFAULT_LOCALE,
};

function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(v);
}

/** Section wrapper — gives every grouping a consistent card look. */
function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${title.replace(/\s+/g, '-').toLowerCase()}-heading`}
      className="flex w-full flex-col gap-[var(--space-3)]"
    >
      <h2
        id={`${title.replace(/\s+/g, '-').toLowerCase()}-heading`}
        className="px-[var(--space-2)] text-lg text-[var(--color-primary-dark)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {title}
      </h2>
      <div className="flex w-full flex-col gap-[var(--space-3)] rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-[var(--space-3)]">
        {children}
      </div>
    </section>
  );
}

/** Radio card — full-width tappable card around a Radix radio item. */
function RadioCard({
  value,
  label,
  description,
}: {
  value: string;
  label: string;
  description?: string;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex w-full cursor-pointer items-center gap-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-4)] shadow-[var(--shadow-card)] transition-transform duration-[var(--motion-fast)] active:scale-[0.99]"
      style={{ minHeight: 'var(--tap-min-young)' }}
    >
      <RadioGroup.Item
        id={id}
        value={value}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-pill)] border-2 border-[var(--color-primary)] bg-[var(--color-surface-high)]"
      >
        <RadioGroup.Indicator className="block h-3 w-3 rounded-[var(--radius-pill)] bg-[var(--color-primary)]" />
      </RadioGroup.Item>
      <div className="flex flex-col">
        <span
          className="text-base text-[var(--color-ink)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {label}
        </span>
        {description ? (
          <span className="text-sm text-[var(--color-mist)]">{description}</span>
        ) : null}
      </div>
    </label>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const t = useTranslations();
  const [state, setState] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [parentGateOpen, setParentGateOpen] = useState(false);
  const [pendingMicEnable, setPendingMicEnable] = useState(false);
  const [pendingParentRoute, setPendingParentRoute] = useState(false);
  const [showMicPrimer, setShowMicPrimer] = useState(false);

  // Initial hydration from Dexie.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [
        audioMaster,
        audioMusic,
        audioSfx,
        audioVoice,
        muted,
        focusMode,
        mascotChoice,
        narrationSpeed,
        ageBand,
        captionsExplicit,
        autoplaySongs,
        micEnabled,
        micEngine,
        fontDyslexia,
        motionReduced,
        contrastHigh,
        localeRaw,
      ] = await Promise.all([
        getSetting<number>('audio.master', DEFAULT_SETTINGS.audioMaster),
        getSetting<number>('audio.music', DEFAULT_SETTINGS.audioMusic),
        getSetting<number>('audio.sfx', DEFAULT_SETTINGS.audioSfx),
        getSetting<number>('audio.voice', DEFAULT_SETTINGS.audioVoice),
        getSetting<boolean>('audio.muted', DEFAULT_SETTINGS.muted),
        getSetting<boolean>('audio.focusMode', DEFAULT_SETTINGS.focusMode),
        getSetting<MascotChoice>('mascot.choice', DEFAULT_SETTINGS.mascotChoice),
        getSetting<NarrationSpeed>('narration.speed', DEFAULT_SETTINGS.narrationSpeed),
        getSetting<AgeBand>('age.band', DEFAULT_SETTINGS.ageBand),
        // Captions: derive default from age.band when unset. We probe with a
        // sentinel-unset value to detect "not yet stored".
        getSetting<boolean | null>('captions.enabled', null),
        getSetting<boolean>('songs.autoplay', DEFAULT_SETTINGS.autoplaySongs),
        getSetting<boolean>('mic.enabled', DEFAULT_SETTINGS.micEnabled),
        getSetting<MicEngine>('mic.engine', DEFAULT_SETTINGS.micEngine),
        getSetting<boolean>('font.dyslexia', DEFAULT_SETTINGS.fontDyslexia),
        getSetting<boolean>('motion.reduced', DEFAULT_SETTINGS.motionReduced),
        getSetting<boolean>('contrast.high', DEFAULT_SETTINGS.contrastHigh),
        getSetting<unknown>('ui.locale', DEFAULT_SETTINGS.locale),
      ]);
      if (cancelled) return;
      const captionsEnabled =
        captionsExplicit === null ? ageBand === '6-8' : captionsExplicit;
      const locale: Locale = isLocale(localeRaw) ? localeRaw : DEFAULT_SETTINGS.locale;
      setState({
        audioMaster,
        audioMusic,
        audioSfx,
        audioVoice,
        muted,
        focusMode,
        mascotChoice,
        narrationSpeed,
        captionsEnabled,
        autoplaySongs,
        micEnabled,
        micEngine,
        fontDyslexia,
        motionReduced,
        contrastHigh,
        ageBand,
        locale,
      });
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(
    async <K extends keyof SettingsState>(
      key: K,
      value: SettingsState[K],
      settingKey: string,
      announceMsg: string,
    ) => {
      setState((prev) => ({ ...prev, [key]: value }));
      try {
        await setSetting(settingKey, value);
        setAnnounce(announceMsg);
      } catch {
        setAnnounce(t('common.couldNotSave'));
      }
    },
    [t],
  );

  // Volume handlers — write through to AudioPlayer immediately.
  const handleVolume = useCallback(
    async (
      channel: 'master' | 'music' | 'sfx' | 'voice',
      stateKey: keyof SettingsState,
      settingKey: string,
      announceKey: string,
      value: number,
    ) => {
      await persist(stateKey, value as never, settingKey, t(announceKey, { value }));
      void applyVolume(channel, value);
    },
    [persist, t],
  );

  const handleMute = useCallback(
    async (next: boolean) => {
      await persist('muted', next, 'audio.muted', next ? t('settings.announceSoundOff') : t('settings.announceSoundOn'));
      void applyMute(next);
    },
    [persist, t],
  );

  const handleFocus = useCallback(
    async (next: boolean) => {
      await persist(
        'focusMode',
        next,
        'audio.focusMode',
        next ? t('settings.announceFocusOn') : t('settings.announceFocusOff'),
      );
      void applyFocusMode(next);
    },
    [persist, t],
  );

  // Reading-help toggles also re-apply DOM effects.
  const handleFontDyslexia = useCallback(
    async (next: boolean) => {
      await persist(
        'fontDyslexia',
        next,
        'font.dyslexia',
        next ? t('settings.announceFontOn') : t('settings.announceFontOff'),
      );
      applySettingsToDom({
        'font.dyslexia': next,
        'motion.reduced': state.motionReduced,
        'contrast.high': state.contrastHigh,
      });
    },
    [persist, t, state.motionReduced, state.contrastHigh],
  );

  const handleMotionReduced = useCallback(
    async (next: boolean) => {
      await persist(
        'motionReduced',
        next,
        'motion.reduced',
        next ? t('settings.announceMotionOn') : t('settings.announceMotionOff'),
      );
      applySettingsToDom({
        'font.dyslexia': state.fontDyslexia,
        'motion.reduced': next,
        'contrast.high': state.contrastHigh,
      });
    },
    [persist, t, state.fontDyslexia, state.contrastHigh],
  );

  const handleContrast = useCallback(
    async (next: boolean) => {
      await persist(
        'contrastHigh',
        next,
        'contrast.high',
        next ? t('settings.announceContrastOn') : t('settings.announceContrastOff'),
      );
      applySettingsToDom({
        'font.dyslexia': state.fontDyslexia,
        'motion.reduced': state.motionReduced,
        'contrast.high': next,
      });
    },
    [persist, t, state.fontDyslexia, state.motionReduced],
  );

  // Mic enable — gate behind ParentGate the first time it's flipped on.
  const handleMicEnable = useCallback(
    async (next: boolean) => {
      if (next) {
        // First enable: open parent gate, defer the actual enable until pass.
        setPendingMicEnable(true);
        setParentGateOpen(true);
        return;
      }
      // Disabling: no gate required.
      await persist('micEnabled', false, 'mic.enabled', t('settings.announceMicOff'));
    },
    [persist, t],
  );

  const handleParentGatePass = useCallback(() => {
    if (pendingParentRoute) {
      setPendingParentRoute(false);
      router.push('/parent');
      return;
    }
    if (pendingMicEnable) {
      setPendingMicEnable(false);
      void persist('micEnabled', true, 'mic.enabled', t('settings.announceMicOn'));
      setShowMicPrimer(true);
    }
  }, [pendingMicEnable, pendingParentRoute, persist, router, t]);

  const handleParentGateOpenChange = useCallback((open: boolean) => {
    setParentGateOpen(open);
    if (!open) {
      // Cancelled — clear any pending intents.
      setPendingMicEnable(false);
      setPendingParentRoute(false);
    }
  }, []);

  const openParentDashboard = useCallback(() => {
    setPendingParentRoute(true);
    setParentGateOpen(true);
  }, []);

  // Whisper offline engine: lazy-load on opt-in. The model artifact may not
  // be bundled (Sprint 3); we report 'error' / 'model-not-bundled' so the
  // hook can fall back to Web Speech transparently.
  const [whisperProgress, setWhisperProgress] = useState<WhisperLoadProgress>({
    status: 'idle',
    bytesLoaded: 0,
    bytesTotal: 0,
    error: null,
  });

  const handleMicEngineToggle = useCallback(
    async (next: boolean) => {
      const engine = next ? 'whisper-offline' : 'web-speech';
      await persist(
        'micEngine',
        engine,
        'mic.engine',
        next ? t('settings.announceEngineOffline') : t('settings.announceEngineDefault'),
      );
      if (next) {
        // Kick the loader. We don't await — the UI streams progress via the
        // callback. If the model is not bundled, the loader will surface
        // `model-not-bundled` and the activity will quietly fall back to
        // Web Speech at runtime.
        try {
          await loadWhisper((p) => setWhisperProgress(p));
        } catch {
          // Already surfaced via the progress callback.
        }
      }
    },
    [persist, t],
  );

  const whisperPct: number =
    whisperProgress.bytesTotal > 0
      ? Math.min(
          100,
          Math.round((whisperProgress.bytesLoaded / whisperProgress.bytesTotal) * 100),
        )
      : 0;

  const engineStatusLabel: string = (() => {
    if (!state.micEnabled) return t('settings.engineStatusOff');
    if (state.micEngine === 'web-speech') {
      return t('settings.mic.engineOnline');
    }
    switch (whisperProgress.status) {
      case 'ready':
        return t('settings.mic.engineReady');
      case 'loading':
        return t('settings.mic.engineDownloading', { percent: whisperPct });
      case 'placeholder':
        return t('settings.mic.enginePlaceholder');
      case 'error':
        return t('settings.mic.engineError');
      default:
        return t('settings.mic.engineOffline');
    }
  })();

  // Disable the toggle while a download is in flight OR when the binary is
  // a placeholder. Re-enable on `ready` (re-test available) and `idle`.
  const offlineToggleDisabled =
    !state.micEnabled ||
    whisperProgress.status === 'loading' ||
    whisperProgress.status === 'placeholder';

  return (
    <main className="flex min-h-dvh flex-col bg-[var(--color-surface)]">
      <TopBar title={t('settings.title')} onBack={() => router.back()} />

      <span aria-live="polite" className="sr-only">
        {announce}
      </span>

      {!loaded ? (
        <p
          role="status"
          aria-live="polite"
          className="px-[var(--space-6)] py-[var(--space-10)] text-center text-[var(--color-ink)]"
        >
          {t('settings.loading')}
        </p>
      ) : (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-[var(--space-6)] px-[var(--space-4)] py-[var(--space-6)] pb-[var(--space-16)]">
          <Section title={t('settings.sound')}>
            <div className="flex flex-col gap-[var(--space-4)] rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-4)] shadow-[var(--shadow-card)]">
              <VolumeSlider
                label={t('settings.masterVolume')}
                value={state.audioMaster}
                onChange={(v) =>
                  void handleVolume('master', 'audioMaster', 'audio.master', 'settings.announceMasterVolume', v)
                }
              />
              <VolumeSlider
                label={t('settings.music')}
                value={state.audioMusic}
                onChange={(v) =>
                  void handleVolume('music', 'audioMusic', 'audio.music', 'settings.announceMusic', v)
                }
              />
              <VolumeSlider
                label={t('settings.soundEffects')}
                value={state.audioSfx}
                onChange={(v) =>
                  void handleVolume('sfx', 'audioSfx', 'audio.sfx', 'settings.announceSfx', v)
                }
              />
              <VolumeSlider
                label={t('settings.voiceLabel')}
                value={state.audioVoice}
                onChange={(v) =>
                  void handleVolume('voice', 'audioVoice', 'audio.voice', 'settings.announceVoice', v)
                }
              />
            </div>
            <ToggleRow
              label={t('settings.muteAll')}
              description={t('settings.muteAllDesc')}
              checked={state.muted}
              onCheckedChange={(v) => void handleMute(v)}
            />
            <ToggleRow
              label={t('settings.focusMode')}
              description={t('settings.focusModeDesc')}
              checked={state.focusMode}
              onCheckedChange={(v) => void handleFocus(v)}
            />
          </Section>

          <Section title={t('settings.voice')}>
            <div className="flex w-full flex-col gap-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-4)] shadow-[var(--shadow-card)]">
              <span
                id="mascot-voice-label"
                className="text-base text-[var(--color-ink)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {t('settings.mascotVoice')}
              </span>
              <RadioGroup.Root
                aria-labelledby="mascot-voice-label"
                value={state.mascotChoice}
                onValueChange={(v) =>
                  void persist(
                    'mascotChoice',
                    v as MascotChoice,
                    'mascot.choice',
                    t('settings.announceBuddySet', { choice: v }),
                  )
                }
                className="flex flex-col gap-[var(--space-2)]"
              >
                <RadioCard value="milo" label={t('settings.mascotMilo')} description={t('settings.mascotMiloDesc')} />
                <RadioCard value="luna" label={t('settings.mascotLuna')} description={t('settings.mascotLunaDesc')} />
                <RadioCard
                  value="both"
                  label={t('settings.mascotBoth')}
                  description={t('settings.mascotBothDesc')}
                />
              </RadioGroup.Root>
            </div>

            <div className="flex w-full flex-col gap-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-4)] shadow-[var(--shadow-card)]">
              <span
                id="narration-speed-label"
                className="text-base text-[var(--color-ink)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {t('settings.narrationSpeed')}
              </span>
              <RadioGroup.Root
                aria-labelledby="narration-speed-label"
                value={state.narrationSpeed}
                onValueChange={(v) =>
                  void persist(
                    'narrationSpeed',
                    v as NarrationSpeed,
                    'narration.speed',
                    t('settings.announceNarrationSpeed', { speed: v }),
                  )
                }
                className="flex flex-col gap-[var(--space-2)]"
              >
                <RadioCard value="slow" label={t('settings.narrationSlow')} description={t('settings.narrationSlowDesc')} />
                <RadioCard value="normal" label={t('settings.narrationNormal')} description={t('settings.narrationNormalDesc')} />
                <RadioCard value="fast" label={t('settings.narrationFast')} description={t('settings.narrationFastDesc')} />
              </RadioGroup.Root>
            </div>

            <ToggleRow
              label={t('settings.captions')}
              description={t('settings.captionsDesc')}
              checked={state.captionsEnabled}
              onCheckedChange={(v) =>
                void persist(
                  'captionsEnabled',
                  v,
                  'captions.enabled',
                  v ? t('settings.announceCaptionsOn') : t('settings.announceCaptionsOff'),
                )
              }
            />
          </Section>

          <Section title={t('settings.songs')}>
            <ToggleRow
              label={t('settings.autoplaySongs')}
              description={t('settings.autoplaySongsDesc')}
              checked={state.autoplaySongs}
              onCheckedChange={(v) =>
                void persist(
                  'autoplaySongs',
                  v,
                  'songs.autoplay',
                  v ? t('settings.announceAutoplayOn') : t('settings.announceAutoplayOff'),
                )
              }
            />
          </Section>

          <Section title={t('settings.microphone')}>
            <ToggleRow
              label={t('settings.enableMic')}
              description={t('settings.enableMicDesc')}
              checked={state.micEnabled}
              onCheckedChange={(v) => void handleMicEnable(v)}
            />
            <div
              className="flex w-full items-center justify-between gap-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-4)] shadow-[var(--shadow-card)]"
              style={{ minHeight: 'var(--tap-min-young)' }}
            >
              <div className="flex flex-col">
                <span
                  className="text-base text-[var(--color-ink)]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {t('settings.testMic')}
                </span>
                <span className="text-sm text-[var(--color-mist)]">
                  {t('settings.testMicDesc')}
                </span>
              </div>
              <button
                type="button"
                disabled
                aria-disabled="true"
                title={t('settings.testMicDesc')}
                className="flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-[var(--space-6)] text-[var(--color-mist)] opacity-60"
                style={{
                  minHeight: 'var(--tap-min-young)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {t('common.test')}
              </button>
            </div>
            <ToggleRow
              label={t('settings.mic.engineOffline')}
              description={t('settings.offlineEngineDesc')}
              checked={state.micEngine === 'whisper-offline'}
              disabled={offlineToggleDisabled}
              onCheckedChange={(v) => void handleMicEngineToggle(v)}
            />
            {state.micEnabled && state.micEngine === 'whisper-offline' &&
            whisperProgress.status === 'loading' ? (
              // biome-ignore lint/a11y/useFocusableInteractive: progressbar is a non-interactive status indicator (per WAI-ARIA 1.2 §progressbar)
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={whisperProgress.bytesTotal || 1}
                aria-valuenow={whisperProgress.bytesLoaded}
                aria-label={t('settings.mic.engineDownloading', { percent: whisperPct })}
                className="flex w-full flex-col gap-[var(--space-2)] rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-3)] shadow-[var(--shadow-card)]"
              >
                <span className="text-sm text-[var(--color-ink)]">
                  {t('settings.mic.engineDownloading', { percent: whisperPct })}
                </span>
                <div className="h-2 w-full overflow-hidden rounded-[var(--radius-pill)] bg-[var(--color-surface)]">
                  <div
                    className="h-full bg-[var(--color-primary)]"
                    style={{
                      width:
                        whisperProgress.bytesTotal > 0 ? `${whisperPct}%` : '5%',
                    }}
                  />
                </div>
              </div>
            ) : null}
            {state.micEnabled && state.micEngine === 'whisper-offline' &&
            whisperProgress.status === 'ready' ? (
              <div className="flex w-full items-center justify-between gap-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-4)] shadow-[var(--shadow-card)]">
                <span className="text-sm text-[var(--color-ink)]">
                  {t('settings.mic.engineReady')}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setWhisperProgress({
                      status: 'idle',
                      bytesLoaded: 0,
                      bytesTotal: 0,
                      error: null,
                    });
                    void handleMicEngineToggle(true);
                  }}
                  className="flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-[var(--space-4)] text-[var(--color-surface-high)] shadow-[var(--shadow-pop)]"
                  style={{
                    minHeight: 'var(--tap-min-young)',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  {t('settings.mic.retest')}
                </button>
              </div>
            ) : null}
            <p
              role="status"
              aria-live="polite"
              className="px-[var(--space-2)] text-sm text-[var(--color-mist)]"
            >
              {engineStatusLabel}
            </p>
            <p className="px-[var(--space-2)] text-sm text-[var(--color-mist)]">
              {t('settings.micPrivacyNote')}
            </p>
          </Section>

          <Section title={t('settings.readingHelp')}>
            <ToggleRow
              label={t('settings.easierFont')}
              description={t('settings.easierFontDesc')}
              checked={state.fontDyslexia}
              onCheckedChange={(v) => void handleFontDyslexia(v)}
            />
            <ToggleRow
              label={t('settings.reduceMotion')}
              description={t('settings.reduceMotionDesc')}
              checked={state.motionReduced}
              onCheckedChange={(v) => void handleMotionReduced(v)}
            />
            <ToggleRow
              label={t('settings.highContrast')}
              description={t('settings.highContrastDesc')}
              checked={state.contrastHigh}
              onCheckedChange={(v) => void handleContrast(v)}
            />
          </Section>

          <Section title={t('settings.language')}>
            <div className="flex w-full flex-col gap-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-4)] shadow-[var(--shadow-card)]">
              <span
                id="locale-label"
                className="text-base text-[var(--color-ink)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {t('settings.appLanguage')}
              </span>
              <RadioGroup.Root
                aria-labelledby="locale-label"
                value={state.locale}
                onValueChange={(v) => {
                  const next = isLocale(v) ? v : DEFAULT_LOCALE;
                  void persist(
                    'locale',
                    next,
                    'ui.locale',
                    next === 'tr' ? t('settings.languageAnnounceTr') : t('settings.languageAnnounceEn'),
                  );
                  // Tell the I18nProvider to reload the bundle immediately.
                  notifyLocaleChanged();
                }}
                className="flex flex-col gap-[var(--space-2)]"
              >
                <RadioCard value="en" label={t('settings.languageEnglish')} description={t('settings.languageEnglishDesc')} />
                <RadioCard value="tr" label={t('settings.languageTurkish')} description={t('settings.languageTurkishDesc')} />
              </RadioGroup.Root>
            </div>
          </Section>

          <Section title={t('settings.parentTools')}>
            <button
              type="button"
              onClick={openParentDashboard}
              className="flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)] px-[var(--space-6)] py-[var(--space-4)] text-[var(--color-surface-high)] shadow-[var(--shadow-pop)] transition-transform duration-[var(--motion-fast)] active:scale-[0.98]"
              style={{
                minHeight: 'var(--tap-primary-old)',
                fontFamily: 'var(--font-display)',
                fontSize: '1.125rem',
              }}
            >
              {t('settings.openParentDashboard')}
            </button>
          </Section>
        </div>
      )}

      <ParentGate
        open={parentGateOpen}
        onOpenChange={handleParentGateOpenChange}
        onPass={handleParentGatePass}
        title={t('gate.title')}
        description={t('gate.descriptionDefault')}
      />

      {showMicPrimer ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="mic-primer-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(31,41,51,0.55)] px-[var(--space-4)]"
        >
          <div className="w-[min(420px,92vw)] rounded-[var(--radius-xl)] bg-[var(--color-surface-high)] p-[var(--space-6)] shadow-[var(--shadow-pop)]">
            <h2
              id="mic-primer-title"
              className="text-2xl text-[var(--color-primary-dark)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {t('settings.micPrimerTitle')}
            </h2>
            <p className="mt-[var(--space-4)] text-base text-[var(--color-ink)]">
              {t('settings.micPrimerBody')}
            </p>
            <button
              type="button"
              onClick={() => setShowMicPrimer(false)}
              className="mt-[var(--space-6)] flex w-full items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-[var(--space-6)] text-[var(--color-surface-high)] shadow-[var(--shadow-pop)]"
              style={{
                minHeight: 'var(--tap-primary-old)',
                fontFamily: 'var(--font-display)',
                fontSize: '1.125rem',
              }}
            >
              {t('onboarding.gotIt')}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
