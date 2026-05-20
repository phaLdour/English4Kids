'use client';

import type { KeyboardEvent } from 'react';
import { cn } from '../utils/cn';

export type MicButtonState = 'idle' | 'listening' | 'processing' | 'disabled';
export type MicButtonSize = 'young' | 'old';

export interface MicButtonProps {
  state?: MicButtonState;
  size?: MicButtonSize;
  label?: string;
  onPress?: () => void;
  className?: string;
}

const SIZE_PX: Record<MicButtonSize, string> = {
  young: '96px',
  old: '72px',
};

const STATE_BG: Record<MicButtonState, string> = {
  idle: 'var(--color-primary)',
  listening: 'var(--color-primary)',
  processing: 'var(--color-primary-dark)',
  disabled: 'var(--color-muted)',
};

// Mic policy: this component renders UI only. Caller wires MediaRecorder
// or @e4k/audio mic logic. Never instantiate getUserMedia here.
export function MicButton({
  state = 'idle',
  size = 'young',
  label = 'Tap to talk',
  onPress,
  className,
}: MicButtonProps) {
  const px = SIZE_PX[size];
  const disabled = state === 'disabled' || state === 'processing';

  const handleClick = () => {
    if (disabled) return;
    onPress?.();
  };

  const handleKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  };

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={state === 'listening'}
      aria-busy={state === 'processing'}
      data-state={state}
      disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKey}
      className={cn(
        'relative inline-flex items-center justify-center rounded-[var(--radius-pill)] text-[var(--color-surface-high)] shadow-[var(--shadow-pop)] transition-transform duration-[var(--motion-fast)] active:scale-95 disabled:opacity-70',
        className,
      )}
      style={{
        backgroundColor: STATE_BG[state],
        height: px,
        width: px,
        minHeight: px,
        minWidth: px,
      }}
    >
      <span
        aria-hidden="true"
        style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', lineHeight: 1 }}
      >
        {state === 'processing' ? '...' : 'Talk'}
      </span>
      {state === 'listening' ? (
        <span
          aria-hidden="true"
          className="absolute right-1 top-1 block h-3 w-3 rounded-[var(--radius-pill)]"
          style={{
            backgroundColor: 'var(--color-mic-live)',
            boxShadow: '0 0 0 4px rgba(230, 57, 70, 0.25)',
          }}
        />
      ) : null}
    </button>
  );
}
