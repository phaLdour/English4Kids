'use client';

/**
 * Parent settings — over-and-above the child-facing /settings page.
 *
 * Every write here is a sensitive action: the parent is inside /parent/* so
 * the layout-level math gate already guards entry. Individual writes do NOT
 * re-prompt the math gate by default; the layout-level gate (+ 30-min TTL +
 * Lock button) is the policy boundary. This keeps friction sane while
 * preserving the "math gate at every entry" invariant.
 *
 * Pedagogy red line: the daily time limit does NOT show a countdown. When
 * the limit hits we surface a calm "great job today" message via the lesson
 * player; we never panic the child.
 */

import { StrictnessControl } from '@/components/parent/StrictnessControl';
import { track } from '@/lib/plausible-events';
import { loadWhisper } from '@/lib/whisper-loader';
import { type MicEngine, getSetting, setSetting } from '@e4k/db';
import { ToggleRow } from '@e4k/ui';
import * as RadioGroup from '@radix-ui/react-radio-group';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useState } from 'react';

const DEFAULT_LIMIT_6_8 = 20;
const DEFAULT_LIMIT_9_12 = 30;
const MIN_LIMIT = 5;
const MAX_LIMIT = 90;

interface ParentSettingsState {
  micEnabled: boolean;
  micEngine: MicEngine;
  dailyLimitMin: number;
  notificationsAllowed: boolean;
  ageBand: '6-8' | '9-12';
}

function defaultLimitFor(ageBand: '6-8' | '9-12'): number {
  return ageBand === '6-8' ? DEFAULT_LIMIT_6_8 : DEFAULT_LIMIT_9_12;
}

function clampLimit(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_LIMIT_9_12;
  if (n < MIN_LIMIT) return MIN_LIMIT;
  if (n > MAX_LIMIT) return MAX_LIMIT;
  return Math.round(n);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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

export default function ParentSettingsPage() {
  const t = useTranslations();
  const [state, setState] = useState<ParentSettingsState>({
    micEnabled: false,
    micEngine: 'web-speech',
    dailyLimitMin: DEFAULT_LIMIT_9_12,
    notificationsAllowed: false,
    ageBand: '6-8',
  });
  const [loaded, setLoaded] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [whisperStatus, setWhisperStatus] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [micEnabled, micEngine, ageBand, dailyLimitMin, notif] = await Promise.all([
        getSetting<boolean>('mic.enabled', false),
        getSetting<MicEngine>('mic.engine', 'web-speech'),
        getSetting<'6-8' | '9-12'>('age.band', '6-8'),
        getSetting<number | null>('parent.dailyLimitMin', null),
        getSetting<boolean>('parent.notificationsAllowed', false),
      ]);
      if (cancelled) return;
      setState({
        micEnabled,
        micEngine,
        ageBand,
        dailyLimitMin: dailyLimitMin ?? defaultLimitFor(ageBand),
        notificationsAllowed: notif,
      });
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(
    async <K extends keyof ParentSettingsState>(
      key: K,
      value: ParentSettingsState[K],
      settingKey: string,
      msg: string,
    ): Promise<void> => {
      setState((prev) => ({ ...prev, [key]: value }));
      try {
        await setSetting(settingKey, value);
        setAnnounce(msg);
      } catch {
        setAnnounce(t('common.couldNotSave'));
      }
    },
    [t],
  );

  const handleMicToggle = useCallback(
    async (next: boolean): Promise<void> => {
      await persist(
        'micEnabled',
        next,
        'mic.enabled',
        next ? t('parent.settingsMicEnabledAnnounce') : t('parent.settingsMicDisabledAnnounce'),
      );
      // Only fire on ON — we want to count opt-ins, not opt-outs.
      if (next) track('parent_mic_enable');
    },
    [persist, t],
  );

  const handleEngineChange = useCallback(
    async (next: MicEngine): Promise<void> => {
      await persist(
        'micEngine',
        next,
        'mic.engine',
        next === 'whisper-offline'
          ? t('settings.announceEngineOffline')
          : t('settings.announceEngineDefault'),
      );
      if (next === 'whisper-offline') {
        setWhisperStatus(t('parent.settingsEnginePreparing'));
        try {
          await loadWhisper((p) => {
            if (p.status === 'loading') {
              setWhisperStatus(
                p.bytesTotal > 0
                  ? t('parent.settingsEngineDownloading', {
                      pct: Math.round((p.bytesLoaded / p.bytesTotal) * 100),
                    })
                  : t('parent.settingsEngineDownloadingFallback'),
              );
            } else if (p.status === 'ready') {
              setWhisperStatus(t('parent.settingsEngineReady'));
            } else if (p.status === 'error') {
              setWhisperStatus(t('parent.settingsEngineUnavailable'));
            }
          });
        } catch {
          setWhisperStatus(t('parent.settingsEngineUnavailable'));
        }
      } else {
        setWhisperStatus('');
      }
    },
    [persist, t],
  );

  const handleLimitChange = useCallback(
    async (raw: string): Promise<void> => {
      const parsed = Number.parseInt(raw, 10);
      const clamped = clampLimit(parsed);
      await persist(
        'dailyLimitMin',
        clamped,
        'parent.dailyLimitMin',
        t('parent.settingsLimitAnnounce', { minutes: clamped }),
      );
    },
    [persist, t],
  );

  const handleNotifToggle = useCallback(
    async (next: boolean): Promise<void> => {
      // We check browser permission only; we do NOT subscribe to a push service
      // in MVP. PushManager.subscribe is deferred until Phase 2.
      if (next && typeof window !== 'undefined' && typeof window.Notification !== 'undefined') {
        try {
          const perm = await window.Notification.requestPermission();
          if (perm !== 'granted') {
            setAnnounce(t('parent.settingsNotifNotGranted'));
            await persist(
              'notificationsAllowed',
              false,
              'parent.notificationsAllowed',
              t('parent.settingsNotifDenied'),
            );
            return;
          }
        } catch {
          // ignore; treat as denied
          await persist(
            'notificationsAllowed',
            false,
            'parent.notificationsAllowed',
            t('parent.settingsNotifDenied'),
          );
          return;
        }
      }
      await persist(
        'notificationsAllowed',
        next,
        'parent.notificationsAllowed',
        next ? t('parent.settingsNotifGranted') : t('parent.settingsNotifDenied'),
      );
    },
    [persist, t],
  );

  return (
    <main
      data-testid="parent-settings"
      className="mx-auto flex w-full max-w-2xl flex-col gap-[var(--space-6)] px-[var(--space-4)] py-[var(--space-6)] pb-[var(--space-16)]"
    >
      <span aria-live="polite" className="sr-only">
        {announce}
      </span>

      {!loaded ? (
        <p
          role="status"
          aria-live="polite"
          className="px-[var(--space-6)] py-[var(--space-10)] text-center text-[var(--color-ink)]"
        >
          {t('parent.settingsLoading')}
        </p>
      ) : (
        <>
          <Section title={t('parent.settingsMicSection')}>
            <ToggleRow
              label={t('parent.settingsMicEnable')}
              description={t('parent.settingsMicEnableDesc')}
              checked={state.micEnabled}
              onCheckedChange={(v) => void handleMicToggle(v)}
            />
            <p className="px-[var(--space-2)] text-sm text-[var(--color-mist)]">
              {t('parent.settingsMicReminder')}
            </p>
          </Section>

          <Section title={t('parent.settingsEngineSection')}>
            <div className="flex w-full flex-col gap-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-4)] shadow-[var(--shadow-card)]">
              <span
                id="engine-label"
                className="text-base text-[var(--color-ink)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {t('parent.settingsEngineChoose')}
              </span>
              <RadioGroup.Root
                aria-labelledby="engine-label"
                value={state.micEngine}
                onValueChange={(v) => void handleEngineChange(v as MicEngine)}
                className="flex flex-col gap-[var(--space-2)]"
              >
                <RadioCard
                  value="web-speech"
                  label={t('parent.settingsEngineBrowser')}
                  description={t('parent.settingsEngineBrowserDesc')}
                />
                <RadioCard
                  value="whisper-offline"
                  label={t('parent.settingsEngineOffline')}
                  description={t('parent.settingsEngineOfflineDesc')}
                />
              </RadioGroup.Root>
              {whisperStatus ? (
                <p role="status" aria-live="polite" className="text-sm text-[var(--color-mist)]">
                  {whisperStatus}
                </p>
              ) : null}
            </div>
          </Section>

          <Section title={t('parent.settingsStrictnessSection')}>
            <StrictnessControl />
          </Section>

          <Section title={t('parent.settingsLimitSection')}>
            <div className="flex w-full flex-col gap-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-4)] shadow-[var(--shadow-card)]">
              <label
                htmlFor="daily-limit-input"
                className="text-base text-[var(--color-ink)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {t('parent.settingsLimitLabel')}
              </label>
              <input
                id="daily-limit-input"
                type="number"
                inputMode="numeric"
                min={MIN_LIMIT}
                max={MAX_LIMIT}
                value={state.dailyLimitMin}
                onChange={(e) => void handleLimitChange(e.target.value)}
                className="rounded-[var(--radius-md)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-3)] text-base text-[var(--color-ink)]"
                style={{ minHeight: '48px', fontFamily: 'var(--font-mono)' }}
              />
              <p className="text-sm text-[var(--color-mist)]">{t('parent.settingsLimitNote')}</p>
            </div>
          </Section>

          <Section title={t('parent.settingsContentSection')}>
            <p className="rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-4)] text-[var(--color-mist)] shadow-[var(--shadow-card)]">
              {t('parent.settingsContentDesc')}
            </p>
          </Section>

          <Section title={t('parent.settingsNotifSection')}>
            <ToggleRow
              label={t('parent.settingsNotifLabel')}
              description={t('parent.settingsNotifDesc')}
              checked={state.notificationsAllowed}
              onCheckedChange={(v) => void handleNotifToggle(v)}
            />
          </Section>
        </>
      )}
    </main>
  );
}
