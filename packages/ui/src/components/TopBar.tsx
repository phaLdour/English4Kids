'use client';

import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

export interface TopBarProps {
  title?: ReactNode;
  variant?: 'default' | 'minimal';
  onBack?: () => void;
  onOpenSettings?: () => void;
  backLabel?: string;
  settingsLabel?: string;
  className?: string;
}

export function TopBar({
  title,
  variant = 'default',
  onBack,
  onOpenSettings,
  backLabel = 'Go back',
  settingsLabel = 'Open settings',
  className,
}: TopBarProps) {
  if (variant === 'minimal') {
    return null;
  }
  return (
    <header
      className={cn(
        'flex w-full items-center justify-between bg-[var(--color-surface)] px-[var(--space-4)] py-[var(--space-3)]',
        className,
      )}
    >
      <button
        type="button"
        aria-label={backLabel}
        onClick={onBack}
        className="flex items-center justify-center rounded-[var(--radius-pill)] bg-transparent text-[var(--color-primary-dark)] transition-transform duration-[var(--motion-fast)] active:scale-95"
        style={{ minHeight: '64px', minWidth: '64px' }}
      >
        <span
          aria-hidden="true"
          style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', lineHeight: 1 }}
        >
          Back
        </span>
      </button>
      <h1
        className="flex-1 truncate px-[var(--space-3)] text-center text-xl text-[var(--color-ink)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {title}
      </h1>
      <button
        type="button"
        aria-label={settingsLabel}
        onClick={onOpenSettings}
        className="flex items-center justify-center rounded-[var(--radius-pill)] bg-transparent text-[var(--color-primary-dark)] transition-transform duration-[var(--motion-fast)] active:scale-95"
        style={{ minHeight: '64px', minWidth: '64px' }}
      >
        <span
          aria-hidden="true"
          style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', lineHeight: 1 }}
        >
          Menu
        </span>
      </button>
    </header>
  );
}
