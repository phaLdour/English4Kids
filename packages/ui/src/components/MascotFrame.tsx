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

  return (
    <div
      role="img"
      aria-label={`${displayName} mascot, ${reaction}`}
      data-mascot={variant}
      data-reaction={reaction}
      data-reduced-motion={prefersReducedMotion ? 'true' : 'false'}
      className={cn(
        'pointer-events-none fixed bottom-[var(--space-4)] left-[var(--space-4)] flex h-28 w-28 items-center justify-center overflow-hidden rounded-[var(--radius-xl)] text-[var(--color-surface-high)] sm:h-32 sm:w-32',
        className,
      )}
      style={{
        backgroundColor: VARIANT_COLOR[variant],
        boxShadow: VARIANT_SHADOW[variant],
        fontFamily: 'var(--font-display)',
        fontSize: '1.25rem',
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
        // Static fallback: colored pill with the mascot name. Used when
        // (a) prefers-reduced-motion is set, or (b) the Lottie JSON failed
        // to load (offline / not yet cached). Screen readers still get the
        // mascot + reaction via aria-label on the wrapper.
        <span aria-hidden="true">{displayName}</span>
      )}
    </div>
  );
}
