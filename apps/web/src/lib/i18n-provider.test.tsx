import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useTranslations } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Settings store the provider reads from. Mutate between cases to pick the
// locale under test.
const settings = new Map<string, unknown>();

vi.mock('@e4k/db', () => ({
  getSetting: async <T,>(key: string, fallback: T): Promise<T> => {
    if (settings.has(key)) return settings.get(key) as T;
    return fallback;
  },
  setSetting: async (key: string, value: unknown): Promise<void> => {
    settings.set(key, value);
  },
}));

import { I18nProvider, LOCALE_CHANGE_EVENT, notifyLocaleChanged } from './i18n-provider';

/** Tiny consumer that reads a sample key so we can assert on its rendered value. */
function ButtonProbe() {
  const t = useTranslations('common');
  return <button type="button">{t('continue')}</button>;
}

function OnboardingProbe() {
  const t = useTranslations('onboarding');
  return <h1>{t('buddyTitle')}</h1>;
}

describe('I18nProvider', () => {
  beforeEach(() => {
    settings.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders English copy when ui.locale is unset (default)', async () => {
    render(
      <I18nProvider>
        <ButtonProbe />
      </I18nProvider>,
    );
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('Continue');
    });
  });

  it('renders Turkish copy when ui.locale is "tr"', async () => {
    settings.set('ui.locale', 'tr');
    render(
      <I18nProvider>
        <ButtonProbe />
      </I18nProvider>,
    );
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('Devam');
    });
  });

  it('falls back to English when ui.locale is an unsupported value', async () => {
    settings.set('ui.locale', 'klingon');
    render(
      <I18nProvider>
        <ButtonProbe />
      </I18nProvider>,
    );
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('Continue');
    });
  });

  it('resolves namespaced keys from both locales', async () => {
    settings.set('ui.locale', 'tr');
    render(
      <I18nProvider>
        <OnboardingProbe />
      </I18nProvider>,
    );
    await waitFor(() => {
      expect(screen.getByRole('heading')).toHaveTextContent('Arkadaşını seç');
    });
  });

  it('reloads when notifyLocaleChanged() is invoked after the setting changes', async () => {
    render(
      <I18nProvider>
        <ButtonProbe />
      </I18nProvider>,
    );
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('Continue');
    });

    settings.set('ui.locale', 'tr');
    notifyLocaleChanged();

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('Devam');
    });
  });

  it('exposes a documented event name for ad-hoc dispatchers', () => {
    expect(LOCALE_CHANGE_EVENT).toBe('e4k:locale-change');
  });
});
