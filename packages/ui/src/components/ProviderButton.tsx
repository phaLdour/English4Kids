'use client';

/**
 * Sprint 7 — ProviderButton.
 *
 * Branded sign-in button for Apple, Google, or generic email. Apple is the
 * default visual baseline (App Store rule: Apple Sign-In is mandatory if
 * Google is offered; consumers should always render Apple alongside
 * Google).
 *
 * The brand marks are inline SVG strokes — no external font, no remote
 * fetch. Provider names are read by screen readers via the button label,
 * not the icon (the icon is aria-hidden).
 */

import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../utils/cn';

export type ProviderButtonProvider = 'apple' | 'google' | 'email';

export interface ProviderButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  provider: ProviderButtonProvider;
  /** Override the default "Continue with X" label. */
  label?: string;
  fullWidth?: boolean;
}

const DEFAULT_LABEL: Record<ProviderButtonProvider, string> = {
  apple: 'Continue with Apple',
  google: 'Continue with Google',
  email: 'Continue with email',
};

const BG: Record<ProviderButtonProvider, string> = {
  apple: 'var(--color-apple-ink)',
  google: 'var(--color-google-surface)',
  email: 'var(--color-surface)',
};

const FG: Record<ProviderButtonProvider, string> = {
  apple: 'var(--color-apple-surface)',
  google: 'var(--color-google-ink)',
  email: 'var(--color-ink)',
};

const BORDER: Record<ProviderButtonProvider, string> = {
  apple: 'transparent',
  google: 'rgba(31, 41, 51, 0.12)',
  email: 'rgba(31, 41, 51, 0.12)',
};

function AppleMark() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="22"
      viewBox="0 0 18 22"
      fill="currentColor"
      focusable="false"
    >
      <path d="M14.94 11.5c-.03-2.8 2.29-4.16 2.39-4.22-1.3-1.9-3.33-2.16-4.05-2.19-1.72-.18-3.36 1.02-4.24 1.02-.87 0-2.22-1-3.65-.97a5.4 5.4 0 0 0-4.57 2.78c-1.96 3.4-.5 8.42 1.41 11.18.93 1.35 2.04 2.86 3.5 2.8 1.4-.06 1.93-.91 3.63-.91 1.69 0 2.17.91 3.65.88 1.51-.03 2.46-1.37 3.38-2.73a12.06 12.06 0 0 0 1.54-3.16c-.04-.02-2.96-1.14-3-4.48Zm-2.78-8.22c.78-.94 1.3-2.25 1.16-3.55-1.12.05-2.47.74-3.27 1.68-.72.83-1.36 2.17-1.19 3.45 1.25.1 2.52-.63 3.3-1.58Z" />
    </svg>
  );
}

function GoogleMark() {
  // Standard Google G mark colors — Material design tokens.
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48" focusable="false">
      <path
        fill="#4285F4"
        d="M44.5 20H24v8.5h11.7C34.7 33 30 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l6-6C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.2-4z"
      />
      <path
        fill="#34A853"
        d="M6.3 14.7l6.6 4.8C14.6 16.3 19 13 24 13c3 0 5.7 1.1 7.8 2.9l6-6C34.6 6 29.6 4 24 4 16.4 4 9.8 8.3 6.3 14.7z"
      />
      <path
        fill="#FBBC05"
        d="M24 44c5.5 0 10.5-2 14.3-5.4l-6.6-5.4C29.8 34.6 27.1 35.5 24 35.5c-5.9 0-11-4-12.8-9.6l-6.6 5.1C8 39.7 15.4 44 24 44z"
      />
      <path
        fill="#EA4335"
        d="M44.5 20H24v8.5h11.7c-1.2 3.6-5 6-11.7 6-5.9 0-11-4-12.8-9.6l-6.6 5.1C8 39.7 15.4 44 24 44c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.2-4z"
      />
    </svg>
  );
}

function EmailMark() {
  return (
    <svg aria-hidden="true" width="20" height="16" viewBox="0 0 20 16" fill="none" focusable="false">
      <rect
        x="1"
        y="1"
        width="18"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="m2 3 8 6 8-6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Mark({ provider }: { provider: ProviderButtonProvider }) {
  if (provider === 'apple') return <AppleMark />;
  if (provider === 'google') return <GoogleMark />;
  return <EmailMark />;
}

export function ProviderButton({
  provider,
  label,
  fullWidth = true,
  className,
  ...rest
}: ProviderButtonProps) {
  const text = label ?? DEFAULT_LABEL[provider];
  return (
    <button
      type="button"
      {...rest}
      aria-label={text}
      className={cn(
        'inline-flex items-center justify-center gap-[var(--space-3)] rounded-[var(--radius-soft)] transition-transform active:translate-y-[2px]',
        fullWidth && 'w-full',
        className,
      )}
      style={{
        minHeight: '56px',
        paddingInline: 'var(--space-5)',
        backgroundColor: BG[provider],
        color: FG[provider],
        border: `1px solid ${BORDER[provider]}`,
        fontFamily: 'var(--font-display)',
        fontSize: '1rem',
        fontWeight: 600,
        boxShadow: 'var(--shadow-soft)',
        ...((rest as { style?: Record<string, string> }).style ?? {}),
      }}
    >
      <Mark provider={provider} />
      <span>{text}</span>
    </button>
  );
}
