import '@testing-library/jest-dom/vitest';
import React from 'react';
import { vi } from 'vitest';

// The Vite React plugin is not wired into the vitest pipeline for this
// workspace (we keep transform overhead small for test runs). esbuild compiles
// JSX to classic `React.createElement(...)` calls, which look up `React` as a
// global at runtime. Setting `globalThis.React` makes every test file's JSX
// work without each one having to re-export the React import.
(globalThis as { React?: typeof React }).React = React;

// JSDOM does not implement `ResizeObserver`; several Radix primitives (Slider,
// ScrollArea) construct one on mount. A no-op polyfill is enough to keep the
// test runtime alive — the components don't depend on actual size readbacks
// during unit tests.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  (globalThis as { ResizeObserver?: typeof ResizeObserverStub }).ResizeObserver =
    ResizeObserverStub;
}

// JSDOM does not implement `Element.prototype.scrollIntoView`; some Radix
// primitives call it after focus changes. Treat it as a no-op so click flows
// don't throw.
if (
  typeof Element !== 'undefined' &&
  typeof Element.prototype.scrollIntoView !== 'function'
) {
  Element.prototype.scrollIntoView = function scrollIntoViewStub(): void {};
}

// Polyfill `matchMedia` (used by usePrefersReducedMotion and some Radix code).
if (
  typeof window !== 'undefined' &&
  typeof window.matchMedia !== 'function'
) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

// JSDOM has no real canvas backend. `lottie-web` (transitively pulled in by
// `lottie-react`, which `@e4k/ui/MascotFrame` imports) crashes during module
// init when it tries to set `fillStyle` on the null context. The Sprint 4
// runtime path uses `lottie-react` for the mascot animation; the unit tests
// only need a sentinel DOM node so we mock both libraries to a no-op stub.
vi.mock('lottie-react', () => ({
  default: (props: { loop?: boolean }) =>
    React.createElement('div', {
      'data-testid': 'lottie-stub',
      'data-loop': props.loop ? 'true' : 'false',
    }),
}));
vi.mock('lottie-web', () => ({
  default: {
    loadAnimation: () => ({
      play: () => {},
      pause: () => {},
      stop: () => {},
      destroy: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      setSpeed: () => {},
      setDirection: () => {},
      goToAndPlay: () => {},
      goToAndStop: () => {},
    }),
    setQuality: () => {},
    setIDPrefix: () => {},
    setLocationHref: () => {},
    destroy: () => {},
  },
}));
