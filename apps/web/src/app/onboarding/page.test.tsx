import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory mock for setSetting + a stub children table.
const store = new Map<string, unknown>();
const setSettingMock = vi.fn(async (key: string, value: unknown) => {
  store.set(key, value);
});
const childrenPutMock = vi.fn(async () => {});

vi.mock('@e4k/db', () => ({
  setSetting: (key: string, value: unknown) => setSettingMock(key, value),
  getSetting: async <T,>(_key: string, fallback: T): Promise<T> => fallback,
  db: { children: { put: (row: unknown) => childrenPutMock(row) } },
}));

vi.mock('@e4k/audio', () => ({
  AudioUnlock: { unlock: vi.fn(async () => {}) },
}));

vi.mock('@/lib/audio-client', () => ({
  getAudioClient: vi.fn(async () => {
    throw new Error('audio unavailable in tests');
  }),
}));

const replaceMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn(), back: vi.fn() }),
}));

import OnboardingPage from './page';

describe('OnboardingPage', () => {
  beforeEach(() => {
    store.clear();
    setSettingMock.mockClear();
    childrenPutMock.mockClear();
    replaceMock.mockClear();
    // Ensure crypto.randomUUID is callable.
    if (typeof globalThis.crypto === 'undefined') {
      Object.defineProperty(globalThis, 'crypto', {
        value: { randomUUID: () => '00000000-0000-4000-8000-000000000000' },
        configurable: true,
      });
    }
    // speechSynthesis stub.
    Object.defineProperty(window, 'speechSynthesis', {
      value: { speak: vi.fn(), cancel: vi.fn() },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('walks through the onboarding flow end-to-end and writes expected settings', async () => {
    render(<OnboardingPage />);

    // Step 1: Audio unlock.
    const beginBtn = await screen.findByRole('button', { name: /Tap to begin/i });
    fireEvent.click(beginBtn);

    // Step 2: Pick Milo.
    const pickMilo = await screen.findByRole('button', { name: /Pick Milo/i });
    fireEvent.click(pickMilo);
    await waitFor(() => {
      expect(setSettingMock).toHaveBeenCalledWith('mascot.choice', 'milo');
    });

    // Step 3: Age band — default 6-8 selected.
    const continueAge = await screen.findByRole('button', { name: /^Continue$/i });
    fireEvent.click(continueAge);
    await waitFor(() => {
      expect(setSettingMock).toHaveBeenCalledWith('age.band', '6-8');
    });
    expect(setSettingMock).toHaveBeenCalledWith('captions.enabled', true);

    // Step 4: Nickname — pick the first one.
    const sunnyOtter = await screen.findByRole('radio', { name: /Sunny Otter/i });
    fireEvent.click(sunnyOtter);
    const continueNickname = await screen.findByRole('button', { name: /^Continue$/i });
    fireEvent.click(continueNickname);
    await waitFor(() => {
      expect(setSettingMock).toHaveBeenCalledWith('child.nickname', 'Sunny Otter');
    });
    expect(childrenPutMock).toHaveBeenCalledTimes(1);
    const childRow = childrenPutMock.mock.calls[0]?.[0] as { nickname: string; age_band: string };
    expect(childRow.nickname).toBe('Sunny Otter');
    expect(childRow.age_band).toBe('6-8');

    // Step 5: Audio primer.
    const soundsGood = await screen.findByRole('button', { name: /Sounds good!/i });
    fireEvent.click(soundsGood);
    await waitFor(() => {
      expect(setSettingMock).toHaveBeenCalledWith('audio.master', expect.any(Number));
    });

    // Step 6: Mic intro — informational only.
    const gotIt = await screen.findByRole('button', { name: /Got it/i });
    fireEvent.click(gotIt);

    // Step 7: Done — finish and route.
    const start = await screen.findByRole('button', { name: /Start playing/i });
    fireEvent.click(start);

    await waitFor(() => {
      expect(setSettingMock).toHaveBeenCalledWith('onboarding.complete', true);
    });
    expect(replaceMock).toHaveBeenCalledWith('/play');
  });

  it('refreshes nickname list when Refresh for more is tapped', async () => {
    render(<OnboardingPage />);

    // Step 1
    fireEvent.click(await screen.findByRole('button', { name: /Tap to begin/i }));
    // Step 2
    fireEvent.click(await screen.findByRole('button', { name: /Pick Milo/i }));
    // Step 3
    fireEvent.click(await screen.findByRole('button', { name: /^Continue$/i }));

    // Now in nickname step.
    const refresh = await screen.findByRole('button', { name: /Refresh for more/i });
    fireEvent.click(refresh);

    // After refresh, a secondary-set nickname should appear.
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /Joyful Jay/i })).toBeInTheDocument();
    });
  });
});
