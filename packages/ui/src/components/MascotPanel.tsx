'use client';

/**
 * Sprint 7 — MascotPanel.
 *
 * Large, "mascot-forward" presentation primitive for welcome / onboarding /
 * auth flows. The mascot occupies 25-40% of the viewport height inside a
 * rounded soft panel; a speech bubble (optional) carries the prompt. This
 * is the canonical Duolingo-style hero for kid-facing surfaces.
 *
 * Differences from `MascotFrame`:
 *   - MascotPanel is INLINE (block layout), not fixed-position. It is the
 *     hero of the screen, not an ambient corner.
 *   - MascotPanel never renders a "mystery square" fallback — if Lottie is
 *     unavailable (reduced-motion or fetch failed) it falls back to the
 *     mascot's still SVG at `/img/_primitives/{variant}-still.svg`. If even
 *     that fails, it renders the mascot's name in a clearly labelled tile.
 *   - State props use Sprint 7 mood vocabulary (welcoming, encouraging,
 *     thinking, celebrating, listening, gentle-hmm, idle).
 *
 * Accessibility:
 *   - `role="img"` with aria-label describing the mascot + state.
 *   - Reduced-motion path skips Lottie playback entirely.
 *   - Speech bubble text is announced via aria-live=polite by default
 *     (override with `announce={false}` for static screens).
 */

import { useEffect, useState } from 'react';
import Lottie from 'lottie-react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { cn } from '../utils/cn';

export type MascotPanelVariant = 'milo' | 'luna';

export type MascotPanelState =
  | 'welcoming'
  | 'encouraging'
  | 'thinking'
  | 'celebrating'
  | 'listening'
  | 'gentle-hmm'
  | 'idle';

export interface MascotPanelProps {
  variant?: MascotPanelVariant;
  state?: MascotPanelState;
  /** Speech bubble copy (optional). */
  speech?: string;
  /** Override the aria-label (defaults to "Milo welcoming"). */
  label?: string;
  /** Push speech bubble into aria-live region. Default true. */
  announce?: boolean;
  /** Height token override — defaults to 240px / 30% viewport. */
  heightCss?: string;
  className?: string;
}

// Mood → Lottie file mapping. All 14 files already exist in /public/lottie.
const STATE_TO_LOTTIE: Record<MascotPanelState, string> = {
  welcoming: 'waving',
  encouraging: 'encouraging',
  thinking: 'thinking',
  celebrating: 'celebrating',
  listening: 'listening',
  'gentle-hmm': 'gentle-hmm',
  idle: 'idle',
};

const LOOPING: ReadonlySet<MascotPanelState> = new Set<MascotPanelState>([
  'idle',
  'listening',
  'thinking',
]);

type LottieJson = Record<string, unknown>;

export function MascotPanel({
  variant = 'milo',
  state = 'welcoming',
  speech,
  label,
  announce = true,
  heightCss = '240px',
  className,
}: MascotPanelProps) {
  const displayName = variant === 'milo' ? 'Milo' : 'Luna';
  const ariaLabel = label ?? `${displayName} ${state}`;
  const prefersReducedMotion = usePrefersReducedMotion();
  const [animationData, setAnimationData] = useState<LottieJson | null>(null);
  const [stillError, setStillError] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion) {
      setAnimationData(null);
      return;
    }
    let cancelled = false;
    const file = STATE_TO_LOTTIE[state];
    fetch(`/lottie/${variant}-${file}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('mascot-fetch-failed'))))
      .then((data: LottieJson) => {
        if (!cancelled) setAnimationData(data);
      })
      .catch(() => {
        if (!cancelled) setAnimationData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [variant, state, prefersReducedMotion]);

  const lottieAvailable = Boolean(animationData) && !prefersReducedMotion;

  return (
    <section
      data-mascot={variant}
      data-state={state}
      data-reduced-motion={prefersReducedMotion ? 'true' : 'false'}
      className={cn(
        'mx-auto flex w-full max-w-[640px] flex-col items-center gap-[var(--space-4)]',
        className,
      )}
    >
      <div
        role="img"
        aria-label={ariaLabel}
        className="flex w-full items-center justify-center rounded-[var(--radius-soft-lg)] bg-[var(--color-surface-high)]"
        style={{
          height: heightCss,
          boxShadow: 'var(--shadow-panel)',
          padding: 'var(--space-4)',
        }}
      >
        {lottieAvailable ? (
          <Lottie
            animationData={animationData}
            loop={LOOPING.has(state)}
            autoplay
            rendererSettings={{ progressiveLoad: true }}
            aria-hidden="true"
            style={{ width: '100%', height: '100%' }}
          />
        ) : stillError ? (
          <span
            aria-hidden="true"
            className="text-2xl text-[var(--color-mist)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {displayName}
          </span>
        ) : (
          // Static SVG fallback — never a "mystery square". The 215
          // illustration set includes mascot stills at known paths.
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`/img/_primitives/${variant}-still.svg`}
            alt=""
            aria-hidden="true"
            style={{ maxHeight: '100%', maxWidth: '100%' }}
            onError={() => setStillError(true)}
          />
        )}
      </div>

      {speech ? (
        <div
          aria-live={announce ? 'polite' : undefined}
          className="relative w-full rounded-[var(--radius-soft)] bg-[var(--color-surface-high)] px-[var(--space-5)] py-[var(--space-4)] text-center text-[var(--color-ink)]"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '1.125rem',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          {speech}
        </div>
      ) : null}
    </section>
  );
}
