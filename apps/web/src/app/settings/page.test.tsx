import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory mock of Dexie's settings table — keyed string store.
const store = new Map<string, unknown>();
const setSettingMock = vi.fn(async (key: string, value: unknown) => {
  store.set(key, value);
});
const getSettingMock = vi.fn(async <T,>(key: string, fallback: T): Promise<T> => {
  return store.has(key) ? (store.get(key) as T) : fallback;
});

vi.mock('@e4k/db', () => ({
  getSetting: <T,>(key: string, fallback: T) => getSettingMock(key, fallback),
  setSetting: (key: string, value: unknown) => setSettingMock(key, value),
  getAllSettings: async () => Object.fromEntries(store),
}));

// The page module wraps getAudioClient in local helpers; rejecting the
// promise exercises the silent-fallback path without depending on Howler.
vi.mock('@/lib/audio-client', () => ({
  getAudioClient: vi.fn(async () => {
    throw new Error('audio unavailable in tests');
  }),
}));

const pushMock = vi.fn();
const backMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, back: backMock, replace: vi.fn() }),
}));

import SettingsPage from './page';

describe('SettingsPage', () => {
  beforeEach(() => {
    store.clear();
    setSettingMock.mockClear();
    getSettingMock.mockClear();
    pushMock.mockClear();
    backMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders all main settings sections after hydration', async () => {
    render(<SettingsPage />);

    // Wait for hydration to complete (multiple sliders + toggles appear).
    await waitFor(() => {
      expect(screen.getByRole('slider', { name: /Master volume/i })).toBeInTheDocument();
    });

    // Sliders
    expect(screen.getByRole('slider', { name: /Master volume/i })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /Music/i })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /Sound effects/i })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /Voice/i })).toBeInTheDocument();

    // Toggle switches by accessible name
    expect(screen.getByRole('switch', { name: /Mute all/i })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Focus mode/i })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Captions/i })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Auto-play songs/i })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Enable microphone/i })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Easier reading font/i })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Reduce motion/i })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /High contrast/i })).toBeInTheDocument();

    // Parent Tools button present
    expect(
      screen.getByRole('button', { name: /Open Parent Dashboard/i }),
    ).toBeInTheDocument();
  });

  it('persists slider changes to Dexie with correct key+value', async () => {
    render(<SettingsPage />);

    const masterSlider = await screen.findByRole('slider', { name: /Master volume/i });

    // Radix Slider responds to ArrowRight to step the value up by 1.
    masterSlider.focus();
    fireEvent.keyDown(masterSlider, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(setSettingMock).toHaveBeenCalledWith('audio.master', expect.any(Number));
    });

    const masterCall = setSettingMock.mock.calls.find((c) => c[0] === 'audio.master');
    expect(masterCall).toBeDefined();
    expect(typeof masterCall?.[1]).toBe('number');
  });

  it('persists toggle changes (Reduce motion) to Dexie with correct key', async () => {
    render(<SettingsPage />);

    const motionToggle = await screen.findByRole('switch', { name: /Reduce motion/i });
    fireEvent.click(motionToggle);

    await waitFor(() => {
      expect(setSettingMock).toHaveBeenCalledWith('motion.reduced', true);
    });
  });

  it('persists Mute toggle to audio.muted key', async () => {
    render(<SettingsPage />);

    const muteToggle = await screen.findByRole('switch', { name: /Mute all/i });
    fireEvent.click(muteToggle);

    await waitFor(() => {
      expect(setSettingMock).toHaveBeenCalledWith('audio.muted', true);
    });
  });
});
