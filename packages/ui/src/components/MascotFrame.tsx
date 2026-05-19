'use client';

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

export function MascotFrame({
  variant = 'milo',
  reaction = 'idle',
  label,
  className,
}: MascotFrameProps) {
  const displayName = label ?? (variant === 'milo' ? 'Milo' : 'Luna');
  return (
    <div
      role="img"
      aria-label={`${displayName} mascot, ${reaction}`}
      data-mascot={variant}
      data-reaction={reaction}
      className={cn(
        'pointer-events-none fixed bottom-[var(--space-4)] left-[var(--space-4)] flex h-28 w-28 items-center justify-center rounded-[var(--radius-xl)] text-[var(--color-surface-high)] sm:h-32 sm:w-32',
        className,
      )}
      style={{
        backgroundColor: VARIANT_COLOR[variant],
        boxShadow: VARIANT_SHADOW[variant],
        fontFamily: 'var(--font-display)',
        fontSize: '1.25rem',
      }}
    >
      {displayName}
    </div>
  );
}
