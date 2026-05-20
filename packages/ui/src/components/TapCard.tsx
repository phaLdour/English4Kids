'use client';

import type { KeyboardEvent } from 'react';
import { cn } from '../utils/cn';

export type TapCardSize = 'young' | 'old';
export type TapCardResult = 'correct' | 'wrong';

export interface TapCardProps {
  label: string;
  imageSrc?: string;
  imageAlt?: string;
  isCorrect: boolean;
  size?: TapCardSize;
  state?: 'idle' | 'correct' | 'wrong';
  disabled?: boolean;
  onSelect?: (result: TapCardResult) => void;
  className?: string;
}

const DIMENSIONS: Record<TapCardSize, { box: string; img: string }> = {
  young: { box: '160px', img: '120px' },
  old: { box: '120px', img: '88px' },
};

export function TapCard({
  label,
  imageSrc,
  imageAlt,
  isCorrect,
  size = 'young',
  state = 'idle',
  disabled = false,
  onSelect,
  className,
}: TapCardProps) {
  const dims = DIMENSIONS[size];

  const handleActivate = () => {
    if (disabled) return;
    onSelect?.(isCorrect ? 'correct' : 'wrong');
  };

  const handleKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleActivate();
    }
  };

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={state !== 'idle'}
      data-state={state}
      disabled={disabled}
      onClick={handleActivate}
      onKeyDown={handleKey}
      className={cn(
        'flex flex-col items-center justify-center gap-[var(--space-2)] rounded-[var(--radius-lg)] bg-[var(--color-surface-high)] p-[var(--space-3)] shadow-[var(--shadow-card)] transition-transform duration-[var(--motion-base)] active:scale-95 disabled:opacity-60',
        state === 'correct' && 'ring-4',
        state === 'wrong' && 'animate-none',
        className,
      )}
      style={{
        width: dims.box,
        minHeight: dims.box,
        borderColor: 'transparent',
        boxShadow:
          state === 'correct'
            ? '0 0 0 4px var(--color-success), var(--shadow-pop)'
            : 'var(--shadow-card)',
      }}
    >
      <div
        className="flex items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-surface)]"
        style={{ width: dims.img, height: dims.img }}
      >
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt={imageAlt ?? ''}
            width={Number.parseInt(dims.img, 10)}
            height={Number.parseInt(dims.img, 10)}
            // S4-11: kids see one activity at a time; cards beyond the
            // current item are off-screen until the lesson advances.
            loading="lazy"
            decoding="async"
            style={{ objectFit: 'contain' }}
          />
        ) : (
          <span
            aria-hidden="true"
            className="text-[var(--color-mist)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {label.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <span
        className="text-center text-[var(--color-ink)]"
        style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem' }}
      >
        {label}
      </span>
    </button>
  );
}
