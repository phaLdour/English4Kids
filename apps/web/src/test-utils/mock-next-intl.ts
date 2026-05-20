/**
 * Test helper for components that call `useTranslations()` but don't need to
 * exercise the real next-intl provider in a unit test. Importing this module
 * before the system-under-test registers a `vi.mock('next-intl')` that
 * resolves keys against the EN message bundle with simple `{name}` and
 * ICU-plural-friendly interpolation.
 *
 * Usage:
 *
 *   import '@/test-utils/mock-next-intl';
 *
 * Tests that exercise the real provider (e.g. `lib/i18n-provider.test.tsx`)
 * must NOT import this module.
 */
import { vi } from 'vitest';
import enMessages from '../locales/en/common.json';

function lookup(path: string): string {
  const parts = path.split('.');
  let cur: unknown = enMessages;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return path;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === 'string' ? cur : path;
}

function interpolate(template: string, values?: Record<string, unknown>): string {
  if (!values) return template;
  return template.replace(
    /\{(\w+)(?:,\s*plural[\s\S]*?\})?\}/g,
    (match, key: string) => {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        return String((values as Record<string, unknown>)[key]);
      }
      return match;
    },
  );
}

vi.mock('next-intl', () => {
  const useTranslations =
    (namespace?: string) =>
    (key: string, values?: Record<string, unknown>) => {
      const full = namespace ? `${namespace}.${key}` : key;
      return interpolate(lookup(full), values);
    };
  return {
    useTranslations,
    NextIntlClientProvider: ({ children }: { children: unknown }) => children,
  };
});
