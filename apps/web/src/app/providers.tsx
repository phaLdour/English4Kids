'use client';

import { db, getAllSettings } from '@e4k/db';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect, useState } from 'react';
import { I18nProvider } from '@/lib/i18n-provider';
import { applySettingsToDom } from '@/lib/settings-effects';
import { useAutoSync } from '@/lib/sync-client';
import { installWhisperBridge } from '@/lib/whisper-loader';
import { ServiceWorkerRegister } from './serwist-register';

// Wire the @e4k/audio loader bridge once at module evaluation. The bridge
// itself is lazy — it only fetches when WhisperWasmStt.load() is called.
installWhisperBridge();

/**
 * Background cloud-sync driver.
 *
 * Picks the first local child (matches existing dashboard / export / lesson
 * conventions) and hands it to `useAutoSync`. The hook itself gates on the
 * parent profile being non-anonymous, so this component is a NO-OP for the
 * default anonymous-first user.
 *
 * Renders nothing — pure side-effect wrapper.
 */
function CloudSyncDriver(): null {
  const [childId, setChildId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await db.children.toArray();
        if (!cancelled && rows.length > 0 && rows[0]) {
          setChildId(rows[0].id);
        }
      } catch {
        // Dexie unavailable (private mode); skip.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useAutoSync(childId);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  // Hydrate DOM-affecting settings (theme, dyslexia font, reduced motion)
  // on first paint. Safe across remounts; applySettingsToDom is idempotent.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const all = await getAllSettings();
        if (!cancelled) applySettingsToDom(all);
      } catch {
        // Dexie can fail in private browsing — keep app usable with defaults.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <QueryClientProvider client={client}>
      <ServiceWorkerRegister />
      <CloudSyncDriver />
      <I18nProvider>{children}</I18nProvider>
    </QueryClientProvider>
  );
}
