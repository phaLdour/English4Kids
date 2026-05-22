'use client';

import { useEffect, useState } from 'react';
import Lottie from 'lottie-react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { cn } from '../utils/cn';

export type MascotVariant = 'milo' | 'luna';

export type MascotReaction =
  | 'idle'
  | 'listening'
  | 'encouraging'
  | 'celebrating'
  | 'thinking'
  | 'gentle-hmm'
  | 'waving';

export interface MascotFrameProps {
  variant?: MascotVariant;
  reaction?: MascotReaction;
  label?: string;
  className?: string;
}

const VARIANT_COLOR: Record<MascotVariant, string> = {
  milo: 'var(--color-milo)',
  luna: 'var(--color-luna)',
};

const VARIANT_SHADOW: Record<MascotVariant, string> = {
  milo: 'var(--shadow-milo)',
  luna: 'var(--shadow-luna)',
};

// Loop semantics — derived from the audio/UX contract:
//  - idle / listening / thinking are ambient and loop continuously.
//  - encouraging / celebrating / gentle-hmm / waving are one-shot reactions
//    that play once and then hold their final pose (loop = false).
const LOOPING_REACTIONS: ReadonlySet<MascotReaction> = new Set<MascotReaction>([
  'idle',
  'listening',
  'thinking',
]);

function shouldLoop(reaction: MascotReaction): boolean {
  return LOOPING_REACTIONS.has(reaction);
}

// Use `unknown` to avoid pulling lottie-react's full AnimationData type
// surface into our public API; the data is opaque JSON to consumers.
type LottieJson = Record<string, unknown>;

export function MascotFrame({
  variant = 'milo',
  reaction = 'idle',
  label,
  className,
}: MascotFrameProps) {
  const displayName = label ?? (variant === 'milo' ? 'Milo' : 'Luna');
  const prefersReducedMotion = usePrefersReducedMotion();
  const [animationData, setAnimationData] = useState<LottieJson | null>(null);

  useEffect(() => {
    // When the user prefers reduced motion we never fetch — we show the
    // static colored fallback instead. This satisfies the A11y Auditor
    // contract: no animation playback when reduced-motion is set.
    if (prefersReducedMotion) {
      setAnimationData(null);
      return;
    }
    let cancelled = false;
    fetch(`/lottie/${variant}-${reaction}.json`)
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
  }, [variant, reaction, prefersReducedMotion]);

  // Sprint 7 "order with detail" fix:
  //   The previous static fallback rendered a 7-rem colored square anchored
  //   to bottom-left whenever Lottie was unavailable (prefers-reduced-motion
  //   or fetch failed). That square was the "mystery element" called out
  //   during the Wave 0 audit. New behaviour:
  //     - When Lottie is unavailable, fall back to the mascot's still SVG
  //       at /img/_primitives/{variant}-still.svg. The mascot is still
  //       visible, just static.
  //     - If even the still SVG fails to load (e.g. offline before first
  //       cache), render nothing at all — no unexplained square.
  return (
    <div
      role="img"
      aria-label={`${displayName} mascot, ${reaction}`}
      data-mascot={variant}
      data-reaction={reaction}
      data-reduced-motion={prefersReducedMotion ? 'true' : 'false'}
      className={cn(
        'pointer-events-none fixed bottom-[var(--space-4)] left-[var(--space-4)] flex h-28 w-28 items-center justify-center overflow-hidden rounded-[var(--radius-xl)] sm:h-32 sm:w-32',
        className,
      )}
      style={{
        backgroundColor: animationData && !prefersReducedMotion
          ? VARIANT_COLOR[variant]
          : 'transparent',
        boxShadow: animationData && !prefersReducedMotion ? VARIANT_SHADOW[variant] : 'none',
        fontFamily: 'var(--font-display)',
        fontSize: '1.25rem',
        color: 'var(--color-surface-high)',
      }}
    >
      {animationData && !prefersReducedMotion ? (
        <Lottie
          animationData={animationData}
          loop={shouldLoop(reaction)}
          autoplay
          rendererSettings={{ progressiveLoad: true }}
          aria-hidden="true"
          style={{ width: '100%', height: '100%' }}
        />
      ) : (
        // Static SVG fallback — the mascot's still pose. Used when
        // (a) prefers-reduced-motion is set, or (b) the Lottie JSON failed
        // to load. Image element handles its own error state via the
        // browser's broken-image affordance (no visible square).
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={`/img/_primitives/${variant}-still.svg`}
          alt=""
          aria-hidden="true"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      )}
    </div>
  );
}
