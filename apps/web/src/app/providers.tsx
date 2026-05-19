'use client';

import { getAllSettings } from '@e4k/db';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect, useState } from 'react';
import { applySettingsToDom } from '@/lib/settings-effects';

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

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
