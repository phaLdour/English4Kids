'use client';

import { getSetting, setSetting } from '@e4k/db';
import { useCallback, useEffect, useState } from 'react';

/**
 * `BeforeInstallPromptEvent` is a non-standard extension shipped by
 * Chromium-derived browsers. We model only the bits we use.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: ReadonlyArray<string>;
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface InstallPromptProps {
  /**
   * Set to `true` once the child has finished their first lesson. The card is
   * deliberately gated on this flag — per UX/Safety, we never interrupt a
   * first impression with an install ask.
   */
  ready: boolean;
}

const SHOWN_KEY = 'pwa.installPromptShown';

export function InstallPrompt({ ready }: InstallPromptProps): React.JSX.Element | null {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  // Hydrate the persisted "already shown" flag once on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const shown = await getSetting<boolean>(SHOWN_KEY, false);
      if (!cancelled) setPersisted(shown);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Capture the browser's install prompt event when offered.
  useEffect(() => {
    const handler = (event: Event): void => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler as EventListener);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler as EventListener);
    };
  }, []);

  // Surface the card after first-lesson completion.
  useEffect(() => {
    if (!ready) return;
    if (persisted !== false) return;
    if (!deferred) return;
    setVisible(true);
  }, [ready, persisted, deferred]);

  const recordShown = useCallback(async () => {
    try {
      await setSetting(SHOWN_KEY, true);
      setPersisted(true);
    } catch {
      // Settings unavailable (private mode). Hide locally for this session.
      setPersisted(true);
    }
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } finally {
      setVisible(false);
      await recordShown();
    }
  }, [deferred, recordShown]);

  const handleDismiss = useCallback(async () => {
    setVisible(false);
    await recordShown();
  }, [recordShown]);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="install-prompt-title"
      className="fixed inset-x-[var(--space-4)] bottom-[var(--space-4)] z-40 mx-auto max-w-md rounded-[var(--radius-xl)] bg-[var(--color-surface-high)] p-[var(--space-5)] shadow-[var(--shadow-pop)]"
    >
      <h2
        id="install-prompt-title"
        className="mb-[var(--space-2)] text-2xl text-[var(--color-primary-dark)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Want to keep playing offline?
      </h2>
      <p className="mb-[var(--space-4)] text-base text-[var(--color-ink)]">
        Add English4Kids to your home screen so Milo can come along even when
        the Wi-Fi takes a nap.
      </p>
      <div className="flex flex-col gap-[var(--space-2)] sm:flex-row">
        <button
          type="button"
          onClick={handleInstall}
          className="flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-[var(--space-6)] text-[var(--color-surface-high)] shadow-[var(--shadow-pop)]"
          style={{
            minHeight: 'var(--tap-primary-young)',
            fontFamily: 'var(--font-display)',
            fontSize: '1.125rem',
          }}
        >
          Add to my home screen
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="flex items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-primary)] px-[var(--space-6)] text-[var(--color-primary-dark)]"
          style={{
            minHeight: 'var(--tap-primary-young)',
            fontFamily: 'var(--font-display)',
            fontSize: '1rem',
          }}
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
