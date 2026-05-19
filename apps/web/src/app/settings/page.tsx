'use client';

import { getSetting, setSetting, type MicEngine } from '@e4k/db';
import { ParentGate, ToggleRow, TopBar, VolumeSlider } from '@e4k/ui';
import * as RadioGroup from '@radix-ui/react-radio-group';
import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useId, useState } from 'react';
import { getAudioClient } from '@/lib/audio-client';
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

interface SettingsState {
  audioMaster: number;
  audioMusic: number;
  audioSfx: number;
  audioVoice: number;
  muted: boolean;
  focusMode: boolean;
  mascotChoice: 'milo' | 'luna';
  narrationSpeed: NarrationSpeed;
  captionsEnabled: boolean;
  autoplaySongs: boolean;
  micEnabled: boolean;
  micEngine: MicEngine;
  fontDyslexia: boolean;
  motionReduced: boolean;
  contrastHigh: boolean;
  ageBand: AgeBand;
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
};

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
      ] = await Promise.all([
        getSetting<number>('audio.master', DEFAULT_SETTINGS.audioMaster),
        getSetting<number>('audio.music', DEFAULT_SETTINGS.audioMusic),
        getSetting<number>('audio.sfx', DEFAULT_SETTINGS.audioSfx),
        getSetting<number>('audio.voice', DEFAULT_SETTINGS.audioVoice),
        getSetting<boolean>('audio.muted', DEFAULT_SETTINGS.muted),
        getSetting<boolean>('audio.focusMode', DEFAULT_SETTINGS.focusMode),
        getSetting<'milo' | 'luna'>('mascot.choice', DEFAULT_SETTINGS.mascotChoice),
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
      ]);
      if (cancelled) return;
      const captionsEnabled =
        captionsExplicit === null ? ageBand === '6-8' : captionsExplicit;
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
        setAnnounce('Could not save. Please try again.');
      }
    },
    [],
  );

  // Volume handlers — write through to AudioPlayer immediately.
  const handleVolume = useCallback(
    async (
      channel: 'master' | 'music' | 'sfx' | 'voice',
      stateKey: keyof SettingsState,
      settingKey: string,
      label: string,
      value: number,
    ) => {
      await persist(stateKey, value as never, settingKey, `${label} ${value}`);
      void applyVolume(channel, value);
    },
    [persist],
  );

  const handleMute = useCallback(
    async (next: boolean) => {
      await persist('muted', next, 'audio.muted', next ? 'Sound off' : 'Sound on');
      void applyMute(next);
    },
    [persist],
  );

  const handleFocus = useCallback(
    async (next: boolean) => {
      await persist(
        'focusMode',
        next,
        'audio.focusMode',
        next ? 'Focus mode on' : 'Focus mode off',
      );
      void applyFocusMode(next);
    },
    [persist],
  );

  // Reading-help toggles also re-apply DOM effects.
  const handleFontDyslexia = useCallback(
    async (next: boolean) => {
      await persist(
        'fontDyslexia',
        next,
        'font.dyslexia',
        next ? 'Easier reading on' : 'Easier reading off',
      );
      applySettingsToDom({
        'font.dyslexia': next,
        'motion.reduced': state.motionReduced,
        'contrast.high': state.contrastHigh,
      });
    },
    [persist, state.motionReduced, state.contrastHigh],
  );

  const handleMotionReduced = useCallback(
    async (next: boolean) => {
      await persist(
        'motionReduced',
        next,
        'motion.reduced',
        next ? 'Reduced motion on' : 'Reduced motion off',
      );
      applySettingsToDom({
        'font.dyslexia': state.fontDyslexia,
        'motion.reduced': next,
        'contrast.high': state.contrastHigh,
      });
    },
    [persist, state.fontDyslexia, state.contrastHigh],
  );

  const handleContrast = useCallback(
    async (next: boolean) => {
      await persist(
        'contrastHigh',
        next,
        'contrast.high',
        next ? 'High contrast on' : 'High contrast off',
      );
      applySettingsToDom({
        'font.dyslexia': state.fontDyslexia,
        'motion.reduced': state.motionReduced,
        'contrast.high': next,
      });
    },
    [persist, state.fontDyslexia, state.motionReduced],
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
      await persist('micEnabled', false, 'mic.enabled', 'Microphone off');
    },
    [persist],
  );

  const handleParentGatePass = useCallback(() => {
    if (pendingParentRoute) {
      setPendingParentRoute(false);
      router.push('/parent');
      return;
    }
    if (pendingMicEnable) {
      setPendingMicEnable(false);
      void persist('micEnabled', true, 'mic.enabled', 'Microphone ready');
      setShowMicPrimer(true);
    }
  }, [pendingMicEnable, pendingParentRoute, persist, router]);

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
        next ? 'Offline engine selected' : 'Default engine selected',
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
    [persist],
  );

  const engineStatusLabel: string = (() => {
    if (!state.micEnabled) return 'Microphone is off';
    if (state.micEngine === 'web-speech') return 'Engine: Web Speech (built-in)';
    if (whisperProgress.status === 'ready') return 'Engine: Offline (ready)';
    if (whisperProgress.status === 'downloading') {
      const pct =
        whisperProgress.bytesTotal > 0
          ? Math.round((whisperProgress.bytesLoaded / whisperProgress.bytesTotal) * 100)
          : 0;
      return `Engine: Offline (downloading ${pct}%)`;
    }
    if (whisperProgress.status === 'error') {
      return 'Engine: Offline not yet available — using Web Speech for now';
    }
    return 'Engine: Offline (preparing)';
  })();

  return (
    <main className="flex min-h-dvh flex-col bg-[var(--color-surface)]">
      <TopBar title="Settings" onBack={() => router.back()} />

      <span aria-live="polite" className="sr-only">
        {announce}
      </span>

      {!loaded ? (
        <p
          role="status"
          aria-live="polite"
          className="px-[var(--space-6)] py-[var(--space-10)] text-center text-[var(--color-ink)]"
        >
          Loading your settings...
        </p>
      ) : (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-[var(--space-6)] px-[var(--space-4)] py-[var(--space-6)] pb-[var(--space-16)]">
          <Section title="Sound">
            <div className="flex flex-col gap-[var(--space-4)] rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-4)] shadow-[var(--shadow-card)]">
              <VolumeSlider
                label="Master volume"
                value={state.audioMaster}
                onChange={(v) =>
                  void handleVolume('master', 'audioMaster', 'audio.master', 'Master volume', v)
                }
              />
              <VolumeSlider
                label="Music"
                value={state.audioMusic}
                onChange={(v) =>
                  void handleVolume('music', 'audioMusic', 'audio.music', 'Music volume', v)
                }
              />
              <VolumeSlider
                label="Sound effects"
                value={state.audioSfx}
                onChange={(v) =>
                  void handleVolume('sfx', 'audioSfx', 'audio.sfx', 'Sound effects volume', v)
                }
              />
              <VolumeSlider
                label="Voice"
                value={state.audioVoice}
                onChange={(v) =>
                  void handleVolume('voice', 'audioVoice', 'audio.voice', 'Voice volume', v)
                }
              />
            </div>
            <ToggleRow
              label="Mute all"
              description="Silence everything for a quiet moment."
              checked={state.muted}
              onCheckedChange={(v) => void handleMute(v)}
            />
            <ToggleRow
              label="Focus mode"
              description="Quiets music and extra sounds. Voice prompts stay on."
              checked={state.focusMode}
              onCheckedChange={(v) => void handleFocus(v)}
            />
          </Section>

          <Section title="Voice">
            <div className="flex w-full flex-col gap-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-4)] shadow-[var(--shadow-card)]">
              <span
                id="mascot-voice-label"
                className="text-base text-[var(--color-ink)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Mascot voice
              </span>
              <RadioGroup.Root
                aria-labelledby="mascot-voice-label"
                value={state.mascotChoice}
                onValueChange={(v) =>
                  void persist(
                    'mascotChoice',
                    v as 'milo' | 'luna',
                    'mascot.choice',
                    `Buddy set to ${v}`,
                  )
                }
                className="flex flex-col gap-[var(--space-2)]"
              >
                <RadioCard value="milo" label="Milo" description="Warm, friendly guide." />
                {/* Luna placeholder — disabled until Phase 2. Keeps structure ready. */}
                <div
                  className="flex w-full items-center gap-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface)] p-[var(--space-4)] opacity-60"
                  style={{ minHeight: 'var(--tap-min-young)' }}
                  aria-disabled="true"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-pill)] border-2 border-[var(--color-muted)]"
                  />
                  <div className="flex flex-col">
                    <span
                      className="text-base text-[var(--color-mist)]"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      Luna
                    </span>
                    <span className="text-sm text-[var(--color-mist)]">
                      Available in a future update.
                    </span>
                  </div>
                </div>
              </RadioGroup.Root>
            </div>

            <div className="flex w-full flex-col gap-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-4)] shadow-[var(--shadow-card)]">
              <span
                id="narration-speed-label"
                className="text-base text-[var(--color-ink)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Narration speed
              </span>
              <RadioGroup.Root
                aria-labelledby="narration-speed-label"
                value={state.narrationSpeed}
                onValueChange={(v) =>
                  void persist(
                    'narrationSpeed',
                    v as NarrationSpeed,
                    'narration.speed',
                    `Narration speed ${v}`,
                  )
                }
                className="flex flex-col gap-[var(--space-2)]"
              >
                <RadioCard value="slow" label="Slow" description="0.85x — gentle pace." />
                <RadioCard value="normal" label="Normal" description="1.0x — everyday pace." />
                <RadioCard value="fast" label="Fast" description="1.15x — quicker pace." />
              </RadioGroup.Root>
            </div>

            <ToggleRow
              label="Captions"
              description="Show the words on screen while voice plays."
              checked={state.captionsEnabled}
              onCheckedChange={(v) =>
                void persist(
                  'captionsEnabled',
                  v,
                  'captions.enabled',
                  v ? 'Captions on' : 'Captions off',
                )
              }
            />
          </Section>

          <Section title="Songs">
            <ToggleRow
              label="Auto-play songs"
              description="Start the next song without a tap."
              checked={state.autoplaySongs}
              onCheckedChange={(v) =>
                void persist(
                  'autoplaySongs',
                  v,
                  'songs.autoplay',
                  v ? 'Auto-play on' : 'Auto-play off',
                )
              }
            />
          </Section>

          <Section title="Microphone">
            <ToggleRow
              label="Enable microphone"
              description="Used only for speaking practice. Your voice stays on this device."
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
                  Test microphone
                </span>
                <span className="text-sm text-[var(--color-mist)]">
                  Available in the next update.
                </span>
              </div>
              <button
                type="button"
                disabled
                aria-disabled="true"
                title="Available in the next update."
                className="flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-[var(--space-6)] text-[var(--color-mist)] opacity-60"
                style={{
                  minHeight: 'var(--tap-min-young)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                Test
              </button>
            </div>
            <ToggleRow
              label="Offline speech engine"
              description="Extra-private speech check on Chrome. One-time 30 MB download."
              checked={state.micEngine === 'whisper-offline'}
              disabled={!state.micEnabled}
              onCheckedChange={(v) => void handleMicEngineToggle(v)}
            />
            {state.micEnabled && state.micEngine === 'whisper-offline' &&
            whisperProgress.status === 'downloading' ? (
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={whisperProgress.bytesTotal || 1}
                aria-valuenow={whisperProgress.bytesLoaded}
                aria-label="Downloading offline speech model"
                className="flex w-full flex-col gap-[var(--space-2)] rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-3)] shadow-[var(--shadow-card)]"
              >
                <span className="text-sm text-[var(--color-ink)]">
                  Getting the offline engine ready...
                </span>
                <div className="h-2 w-full overflow-hidden rounded-[var(--radius-pill)] bg-[var(--color-surface)]">
                  <div
                    className="h-full bg-[var(--color-primary)]"
                    style={{
                      width:
                        whisperProgress.bytesTotal > 0
                          ? `${Math.min(
                              100,
                              Math.round(
                                (whisperProgress.bytesLoaded /
                                  whisperProgress.bytesTotal) *
                                  100,
                              ),
                            )}%`
                          : '5%',
                    }}
                  />
                </div>
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
              We use your device's built-in speech recognition (Web Speech). Your voice never leaves your device. Want extra privacy on Chrome? Enable the offline engine — a one-time 30 MB download.
            </p>
          </Section>

          <Section title="Reading Help">
            <ToggleRow
              label="Easier reading font"
              description="Switches to Lexend, a font many learners find easier to read."
              checked={state.fontDyslexia}
              onCheckedChange={(v) => void handleFontDyslexia(v)}
            />
            <ToggleRow
              label="Reduce motion"
              description="Calmer animations across the app."
              checked={state.motionReduced}
              onCheckedChange={(v) => void handleMotionReduced(v)}
            />
            <ToggleRow
              label="High contrast"
              description="Stronger colour difference for text and buttons."
              checked={state.contrastHigh}
              onCheckedChange={(v) => void handleContrast(v)}
            />
          </Section>

          <Section title="Parent Tools">
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
              Open Parent Dashboard
            </button>
          </Section>
        </div>
      )}

      <ParentGate
        open={parentGateOpen}
        onOpenChange={handleParentGateOpenChange}
        onPass={handleParentGatePass}
        title="Grown-ups only"
        description="Solve this to continue."
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
              About the microphone
            </h2>
            <p className="mt-[var(--space-4)] text-base text-[var(--color-ink)]">
              When you reach speaking practice, your browser will ask permission to use the
              microphone. Your voice is checked on this device and never sent anywhere.
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
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
