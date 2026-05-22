import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MascotFrame, type MascotReaction, type MascotVariant } from './MascotFrame';

// JSX in this file relies on the React global because the vitest config
// does not run the React JSX runtime plugin.
(globalThis as { React?: typeof React }).React = React;

// Mock lottie-react so the test does not try to instantiate the real
// renderer (which uses canvas / requestAnimationFrame APIs we do not need
// to exercise here). We expose a simple sentinel DOM node so we can assert
// "Lottie rendered" vs "static fallback rendered".
vi.mock('lottie-react', () => ({
  default: ({ loop }: { loop?: boolean }) => (
    <div data-testid="lottie-stub" data-loop={loop ? 'true' : 'false'} />
  ),
}));

// Mock `usePrefersReducedMotion` via the package public entry as well as
// the internal hook path; the component imports the internal path, so the
// internal mock is what the renderer sees, but mocking the package export
// keeps the contract symmetric for downstream tests that go through
// `@e4k/ui`.
const reducedMotionRef = { current: false };
vi.mock('../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => reducedMotionRef.current,
}));
vi.mock('@e4k/ui', async () => {
  const actual = await vi.importActual<typeof import('../index')>('../index');
  return {
    ...actual,
    usePrefersReducedMotion: () => reducedMotionRef.current,
  };
});

const VARIANTS: readonly MascotVariant[] = ['milo', 'luna'];
const REACTIONS: readonly MascotReaction[] = [
  'idle',
  'listening',
  'encouraging',
  'celebrating',
  'thinking',
  'gentle-hmm',
  'waving',
];

// Minimal valid Bodymovin stub — just enough for the component to treat
// the fetch as "success" and pass the JSON through to the (mocked) Lottie.
const lottieStub = {
  v: '5.9.0',
  fr: 30,
  ip: 0,
  op: 30,
  w: 240,
  h: 240,
  nm: 'stub',
  ddd: 0,
  assets: [],
  layers: [],
  markers: [],
};

const fetchMock = vi.fn();

beforeEach(() => {
  reducedMotionRef.current = false;
  fetchMock.mockReset();
  fetchMock.mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(lottieStub),
    } as Response),
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('MascotFrame', () => {
  it('requests the correct /lottie/<variant>-<reaction>.json URL for every combination', async () => {
    for (const variant of VARIANTS) {
      for (const reaction of REACTIONS) {
        fetchMock.mockClear();
        const { unmount } = render(<MascotFrame variant={variant} reaction={reaction} />);
        await waitFor(() => {
          expect(fetchMock).toHaveBeenCalledWith(`/lottie/${variant}-${reaction}.json`);
        });
        unmount();
      }
    }
  });

  it('renders the Lottie animation when reduced motion is OFF and fetch resolves', async () => {
    const { findByTestId } = render(<MascotFrame variant="milo" reaction="idle" />);
    const lottie = await findByTestId('lottie-stub');
    expect(lottie).toBeTruthy();
    // idle is in the LOOPING_REACTIONS set
    expect(lottie.getAttribute('data-loop')).toBe('true');
  });

  it('passes loop=false for one-shot reactions (celebrating)', async () => {
    const { findByTestId } = render(<MascotFrame variant="luna" reaction="celebrating" />);
    const lottie = await findByTestId('lottie-stub');
    expect(lottie.getAttribute('data-loop')).toBe('false');
  });

  it('does not render Lottie and skips fetch when prefers-reduced-motion is true', async () => {
    reducedMotionRef.current = true;
    const { container, queryByTestId } = render(
      <MascotFrame variant="milo" reaction="celebrating" />,
    );
    // Give any pending microtasks a chance to settle so we can be sure
    // no fetch was kicked off in the effect.
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(queryByTestId('lottie-stub')).toBeNull();
    // Sprint 7: static SVG fallback at /img/_primitives/milo-still.svg —
    // no "mystery square" with the display name text.
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('/img/_primitives/milo-still.svg');
    // data attribute marker for downstream a11y assertions
    const wrapper = container.querySelector('[data-mascot="milo"]');
    expect(wrapper?.getAttribute('data-reduced-motion')).toBe('true');
  });

  it('falls back to the static SVG when fetch fails', async () => {
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    const { container, queryByTestId } = render(<MascotFrame variant="luna" reaction="waving" />);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    // Allow the .catch() microtask to flush.
    await act(async () => {
      await Promise.resolve();
    });
    expect(queryByTestId('lottie-stub')).toBeNull();
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('/img/_primitives/luna-still.svg');
  });
});
