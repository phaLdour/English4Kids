/**
 * Safety test for `useMicSession`.
 *
 * Critical assertion: `MediaRecorder` must NEVER be constructed by this hook.
 * Other tests cover the happy path, error fallthrough, and cleanup.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSettingMock: vi.fn(),
  pickSttMock: vi.fn(),
}));
const { getSettingMock, pickSttMock } = mocks;

vi.mock('@e4k/db', () => ({
  getSetting: mocks.getSettingMock,
}));

vi.mock('@e4k/audio', () => ({
  pickStt: mocks.pickSttMock,
}));

import { useMicSession } from './use-mic-session';
import { useMicStore } from './mic-store';

interface FakeAdapter {
  isAvailable: () => boolean;
  recognize: (opts?: { maxDurationMs?: number; lang?: string }) => Promise<{
    transcript: string;
    confidence: number;
  }>;
}

function makeAdapter(over?: Partial<FakeAdapter>): FakeAdapter {
  return {
    isAvailable: () => true,
    recognize: () => Promise.resolve({ transcript: 'hello', confidence: 0.9 }),
    ...over,
  };
}

function installMediaDevices(getUserMedia: (c: MediaStreamConstraints) => Promise<MediaStream>): void {
  const fakeStream = {
    getTracks: () => [
      {
        stop: vi.fn(),
      },
    ],
  } as unknown as MediaStream;
  const wrapped = async (c: MediaStreamConstraints): Promise<MediaStream> => {
    const _ = c;
    await getUserMedia(c);
    return fakeStream;
  };
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: wrapped },
  });
}

function removeMediaDevices(): void {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: undefined,
  });
}

let originalMediaRecorder: typeof window.MediaRecorder | undefined;

describe('useMicSession', () => {
  beforeEach(() => {
    getSettingMock.mockReset();
    pickSttMock.mockReset();
    useMicStore.setState({ active: false, stopRequest: 0 });
    // Install a MediaRecorder spy — fail loudly if anything constructs it.
    originalMediaRecorder = (window as unknown as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder;
    const MediaRecorderSpy = vi.fn(() => {
      throw new Error('MediaRecorder must NEVER be instantiated by useMicSession');
    });
    (window as unknown as { MediaRecorder: typeof MediaRecorder }).MediaRecorder =
      MediaRecorderSpy as unknown as typeof MediaRecorder;
  });

  afterEach(() => {
    removeMediaDevices();
    (window as unknown as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder =
      originalMediaRecorder;
  });

  it('returns state=denied immediately when mic.enabled is false', async () => {
    getSettingMock.mockImplementation(async (key: string, fb: unknown) => {
      if (key === 'mic.enabled') return false;
      if (key === 'mic.engine') return 'web-speech';
      return fb;
    });
    pickSttMock.mockReturnValue(makeAdapter());
    const recognize = vi.fn();
    pickSttMock.mockReturnValue(makeAdapter({ recognize }));

    const gum = vi.fn();
    installMediaDevices(gum);

    const { result } = renderHook(() => useMicSession());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.state).toBe('denied');
    expect(result.current.error).toBe('mic-disabled');
    expect(gum).not.toHaveBeenCalled();
    expect(recognize).not.toHaveBeenCalled();
  });

  it('runs the success flow: requesting-permission -> listening -> idle with lastResult', async () => {
    getSettingMock.mockImplementation(async (key: string, fb: unknown) => {
      if (key === 'mic.enabled') return true;
      if (key === 'mic.engine') return 'web-speech';
      return fb;
    });
    const recognize = vi
      .fn()
      .mockResolvedValue({ transcript: 'hello', confidence: 0.88 });
    pickSttMock.mockReturnValue(makeAdapter({ recognize }));

    const gum = vi.fn().mockResolvedValue(undefined);
    installMediaDevices(gum);

    const { result } = renderHook(() => useMicSession());

    await act(async () => {
      await result.current.start({ maxDurationMs: 1500 });
    });

    expect(gum).toHaveBeenCalledTimes(1);
    expect(recognize).toHaveBeenCalledWith({ lang: 'en-US', maxDurationMs: 1500 });
    expect(result.current.lastResult).toEqual({
      transcript: 'hello',
      confidence: 0.88,
    });
    expect(result.current.state).toBe('idle');
  });

  it('sets state=error when the adapter throws a non-timeout error', async () => {
    getSettingMock.mockImplementation(async (key: string, fb: unknown) => {
      if (key === 'mic.enabled') return true;
      if (key === 'mic.engine') return 'web-speech';
      return fb;
    });
    const recognize = vi.fn().mockRejectedValue(new Error('stt error: aborted'));
    pickSttMock.mockReturnValue(makeAdapter({ recognize }));
    installMediaDevices(vi.fn().mockResolvedValue(undefined));

    const { result } = renderHook(() => useMicSession());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.state).toBe('error');
    expect(result.current.error).toContain('stt error');
  });

  it('treats stt timeout as a benign idle (no scary error)', async () => {
    getSettingMock.mockImplementation(async (key: string, fb: unknown) => {
      if (key === 'mic.enabled') return true;
      if (key === 'mic.engine') return 'web-speech';
      return fb;
    });
    const recognize = vi.fn().mockRejectedValue(new Error('stt timeout'));
    pickSttMock.mockReturnValue(makeAdapter({ recognize }));
    installMediaDevices(vi.fn().mockResolvedValue(undefined));

    const { result } = renderHook(() => useMicSession());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.state).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('stop() returns state to idle and stops emitting active=true', async () => {
    getSettingMock.mockImplementation(async (key: string, fb: unknown) => {
      if (key === 'mic.enabled') return true;
      if (key === 'mic.engine') return 'web-speech';
      return fb;
    });
    let resolveRecognize: ((v: { transcript: string; confidence: number }) => void) | null =
      null;
    const recognize = vi.fn().mockImplementation(
      () =>
        new Promise<{ transcript: string; confidence: number }>((resolve) => {
          resolveRecognize = resolve;
        }),
    );
    pickSttMock.mockReturnValue(makeAdapter({ recognize }));
    installMediaDevices(vi.fn().mockResolvedValue(undefined));

    const { result } = renderHook(() => useMicSession());

    // Kick off start but do not await — recognize will never resolve.
    let startPromise: Promise<void> = Promise.resolve();
    await act(async () => {
      startPromise = result.current.start();
      // Let microtasks flush so the hook transitions through state updates.
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(useMicStore.getState().active).toBe(true);
    });
    expect(result.current.state).toBe('listening');

    act(() => {
      result.current.stop();
    });

    expect(result.current.state).toBe('idle');
    expect(useMicStore.getState().active).toBe(false);

    // Resolve the in-flight promise so the test cleans up.
    if (resolveRecognize) {
      (resolveRecognize as (v: { transcript: string; confidence: number }) => void)({
        transcript: 'late',
        confidence: 0.1,
      });
    }
    await act(async () => {
      await startPromise;
    });
  });

  it('cleans up on unmount without leaving active=true', async () => {
    getSettingMock.mockImplementation(async (key: string, fb: unknown) => {
      if (key === 'mic.enabled') return true;
      if (key === 'mic.engine') return 'web-speech';
      return fb;
    });
    pickSttMock.mockReturnValue(makeAdapter());
    installMediaDevices(vi.fn().mockResolvedValue(undefined));

    const { unmount } = renderHook(() => useMicSession());
    unmount();
    expect(useMicStore.getState().active).toBe(false);
  });

  it('never constructs MediaRecorder during a full success flow', async () => {
    getSettingMock.mockImplementation(async (key: string, fb: unknown) => {
      if (key === 'mic.enabled') return true;
      if (key === 'mic.engine') return 'web-speech';
      return fb;
    });
    const recognize = vi.fn().mockResolvedValue({ transcript: 'hi', confidence: 0.9 });
    pickSttMock.mockReturnValue(makeAdapter({ recognize }));
    installMediaDevices(vi.fn().mockResolvedValue(undefined));

    const constructed = (
      window as unknown as { MediaRecorder: ReturnType<typeof vi.fn> }
    ).MediaRecorder;

    const { result } = renderHook(() => useMicSession());

    await act(async () => {
      await result.current.start();
    });

    expect(constructed).not.toHaveBeenCalled();
  });
});
