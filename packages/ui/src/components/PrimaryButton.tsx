'use client';

/**
 * Sprint 7 — PrimaryButton.
 *
 * Duolingo-style huge pill button. The big, soft, mascot-forward call to
 * action. Three sizes (kids' big-tap default, adult-form medium, settings
 * small). One emphasis variant. No emoji, no icon by default — pair with
 * `ProviderButton` for branded sign-in flows.
 *
 * Accessibility:
 *   - Forwards aria attributes via spread.
 *   - `aria-busy` when `loading` is true; the inner label is preserved for
 *     screen readers ("Sign in", not "Loading…") while the visual
 *     indicator overlays a soft pulse.
 *   - Touch targets default to `--tap-min-young` (64px) for kid surfaces;
 *     adult forms can opt into `size="md"` (48px).
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../utils/cn';

export type PrimaryButtonSize = 'lg' | 'md' | 'sm';
export type PrimaryButtonTone = 'primary' | 'success' | 'milo' | 'neutral';

export interface PrimaryButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: ReactNode;
  size?: PrimaryButtonSize;
  tone?: PrimaryButtonTone;
  loading?: boolean;
  fullWidth?: boolean;
}

const SIZE_HEIGHT: Record<PrimaryButtonSize, string> = {
  lg: '64px',
  md: '56px',
  sm: '44px',
};

const SIZE_FONT: Record<PrimaryButtonSize, string> = {
  lg: '1.25rem',
  md: '1.125rem',
  sm: '1rem',
};

const SIZE_PADX: Record<PrimaryButtonSize, string> = {
  lg: 'var(--space-8)',
  md: 'var(--space-6)',
  sm: 'var(--space-4)',
};

const TONE_BG: Record<PrimaryButtonTone, string> = {
  primary: 'var(--color-primary)',
  success: 'var(--color-success)',
  milo: 'var(--color-milo)',
  neutral: 'var(--color-surface)',
};

const TONE_FG: Record<PrimaryButtonTone, string> = {
  primary: 'var(--color-surface-high)',
  success: 'var(--color-surface-high)',
  milo: 'var(--color-surface-high)',
  neutral: 'var(--color-ink)',
};

export function PrimaryButton({
  children,
  size = 'lg',
  tone = 'primary',
  loading = false,
  fullWidth = false,
  className,
  disabled,
  ...rest
}: PrimaryButtonProps) {
  const inert = disabled || loading;
  return (
    <button
      type="button"
      {...rest}
      aria-busy={loading || undefined}
      disabled={inert}
      className={cn(
        'inline-flex items-center justify-center rounded-[var(--radius-button)] transition-transform active:translate-y-[2px]',
        fullWidth && 'w-full',
        inert && 'opacity-60',
        className,
      )}
      style={{
        minHeight: SIZE_HEIGHT[size],
        paddingInline: SIZE_PADX[size],
        backgroundColor: TONE_BG[tone],
        color: TONE_FG[tone],
        fontFamily: 'var(--font-display)',
        fontSize: SIZE_FONT[size],
        fontWeight: 600,
        boxShadow: 'var(--shadow-soft)',
        ...((rest as { style?: Record<string, string> }).style ?? {}),
      }}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="mr-[var(--space-2)] inline-block h-3 w-3 animate-pulse rounded-[var(--radius-pill)] bg-current"
        />
      ) : null}
      <span>{children}</span>
    </button>
  );
}
