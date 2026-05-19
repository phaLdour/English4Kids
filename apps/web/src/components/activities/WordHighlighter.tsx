'use client';

import { motion } from 'motion/react';
import { usePrefersReducedMotion } from '@e4k/ui';
import type { KeyboardEvent } from 'react';

export interface WordHighlighterProps {
  text: string;
  isActive: boolean;
  onTap?: (text: string) => void;
  className?: string;
}

/**
 * A single karaoke word. When `isActive`, fills with Sunflower and lifts
 * slightly to draw the eye. Tap calls `onTap(text)` so the parent can replay
 * just that word (Web Speech, audio sprite, etc).
 *
 * Reduced motion: no scale/fade; only the background color flips.
 */
export function WordHighlighter({
  text,
  isActive,
  onTap,
  className,
}: WordHighlighterProps) {
  const prefersReduced = usePrefersReducedMotion();

  const handleActivate = () => {
    onTap?.(text);
  };

  const handleKey = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleActivate();
    }
  };

  const baseStyle = {
    backgroundColor: isActive ? 'var(--color-sunflower)' : 'transparent',
    color: 'var(--color-ink)',
    borderRadius: 'var(--radius-sm)',
    padding: '2px 6px',
    margin: '0 2px',
    display: 'inline-block',
    cursor: onTap ? 'pointer' : 'default',
    fontFamily: 'var(--font-body)',
    fontWeight: isActive ? 700 : 500,
  } as const;

  return (
    <motion.span
      role={onTap ? 'button' : undefined}
      tabIndex={onTap ? 0 : undefined}
      aria-label={onTap ? `Say ${text}` : undefined}
      data-active={isActive ? 'true' : 'false'}
      onClick={onTap ? handleActivate : undefined}
      onKeyDown={onTap ? handleKey : undefined}
      animate={
        prefersReduced
          ? { scale: 1 }
          : { scale: isActive ? 1.05 : 1 }
      }
      transition={
        prefersReduced
          ? { duration: 0 }
          : { type: 'spring', stiffness: 220, damping: 18 }
      }
      style={baseStyle}
      className={className}
    >
      {text}
    </motion.span>
  );
}
