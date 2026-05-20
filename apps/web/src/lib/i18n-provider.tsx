'use client';

/**
 * Locale provider for next-intl, driven by the Dexie `ui.locale` setting.
 *
 * Rationale (see ADR 0008): we intentionally avoid a `[locale]` URL segment.
 * The MVP descope froze URLs at the root and the Phase 2 work cannot ship
 * route-tree changes without breaking outstanding bookmarks, the service
 * worker precache, and the parent dashboard CSP exemptions. Instead, locale
 * lives in Dexie and the provider hot-swaps messages on change.
 *
 * Supported locales are EN (baseline) and TR (Phase 2 launch market). Adding
 * another locale only requires dropping a new JSON file into
 * `src/locales/<code>/common.json` and registering it in `SUPPORTED_LOCALES`.
 */

import { getSetting } from '@e4k/db';
import { type AbstractIntlMessages, NextIntlClientProvider } from 'next-intl';
import { type ReactNode, useEffect, useState } from 'react';

export type Locale = 'en' | 'tr';

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'tr'] as const;
export const DEFAULT_LOCALE: Locale = 'en';

// `next-intl`'s message-tree shape; we keep our load layer typed as the same
// recursive map so the provider hand-off type-checks without a cast.
type Messages = AbstractIntlMessages;

/** Custom event other parts of the app can dispatch to notify the provider
 *  that `ui.locale` changed in Dexie. Saves us from polling settings. */
export const LOCALE_CHANGE_EVENT = 'e4k:locale-change';

function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

async function loadMessages(locale: Locale): Promise<Messages> {
  // Dynamic import keeps non-active locales out of the initial chunk; each
  // locale becomes its own webpack chunk.
  if (locale === 'tr') {
    const mod = await import('../locales/tr/common.json');
    return mod.default as Messages;
  }
  const mod = await import('../locales/en/common.json');
  return mod.default as Messages;
}

interface I18nProviderProps {
  children: ReactNode;
  /** Server-rendered initial messages, optional. Avoids a flash when the
   *  default `en` bundle is already known at render time. */
  initialMessages?: Messages;
  initialLocale?: Locale;
}

export function I18nProvider({
  children,
  initialMessages,
  initialLocale,
}: I18nProviderProps) {
  const [locale, setLocale] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE);
  const [messages, setMessages] = useState<Messages>(initialMessages ?? {});
  const [ready, setReady] = useState<boolean>(initialMessages !== undefined);

  // Initial hydration + listen for changes.
  useEffect(() => {
    let cancelled = false;

    const hydrate = async (): Promise<void> => {
      try {
        const raw = await getSetting<unknown>('ui.locale', DEFAULT_LOCALE);
        const next = isLocale(raw) ? raw : DEFAULT_LOCALE;
        const msgs = await loadMessages(next);
        if (cancelled) return;
        setLocale(next);
        setMessages(msgs);
        setReady(true);
      } catch {
        // Dexie unavailable — fall back to the default bundle so the app
        // still renders something localised.
        try {
          const msgs = await loadMessages(DEFAULT_LOCALE);
          if (cancelled) return;
          setMessages(msgs);
          setLocale(DEFAULT_LOCALE);
          setReady(true);
        } catch {
          // Hard failure — render with empty messages; next-intl will warn
          // about each key but the UI does not crash.
          if (!cancelled) setReady(true);
        }
      }
    };

    void hydrate();

    const onChange = (): void => {
      void hydrate();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(LOCALE_CHANGE_EVENT, onChange);
    }
    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener(LOCALE_CHANGE_EVENT, onChange);
      }
    };
  }, []);

  // While we wait for Dexie on first paint, render children with an empty
  // bundle but the default locale; once messages load, the tree re-renders
  // with translations. next-intl tolerates missing keys (it logs and falls
  // back to the key name), so this short window is acceptable.
  if (!ready) {
    return (
      <NextIntlClientProvider locale={DEFAULT_LOCALE} messages={{}}>
        {children}
      </NextIntlClientProvider>
    );
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

/**
 * Helper for callers that just updated `ui.locale` in Dexie and want the
 * provider to re-read it. Decoupled from the persistence so call sites can
 * choose their own write pattern.
 */
export function notifyLocaleChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT));
}
