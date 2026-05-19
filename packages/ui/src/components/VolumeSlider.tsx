'use client';

import * as Slider from '@radix-ui/react-slider';
import { useId } from 'react';
import { cn } from '../utils/cn';

export interface VolumeSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export function VolumeSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  className,
}: VolumeSliderProps) {
  const id = useId();
  const clamped = Math.min(Math.max(value, min), max);

  return (
    <div className={cn('flex w-full flex-col gap-[var(--space-2)]', className)}>
      <div className="flex items-baseline justify-between">
        <label
          htmlFor={id}
          className="text-base text-[var(--color-ink)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {label}
        </label>
        <span
          aria-live="polite"
          className="tabular-nums text-[var(--color-mist)]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {clamped}
        </span>
      </div>
      <Slider.Root
        id={id}
        className="relative flex h-16 w-full touch-none select-none items-center"
        value={[clamped]}
        min={min}
        max={max}
        step={step}
        onValueChange={(values) => {
          const next = values[0];
          if (typeof next === 'number') onChange(next);
        }}
        aria-label={label}
      >
        <Slider.Track className="relative h-3 w-full grow rounded-[var(--radius-pill)] bg-[var(--color-muted)]">
          <Slider.Range className="absolute h-full rounded-[var(--radius-pill)] bg-[var(--color-primary)]" />
        </Slider.Track>
        <Slider.Thumb
          aria-label={`${label} value`}
          className="block rounded-[var(--radius-pill)] bg-[var(--color-surface-high)] shadow-[var(--shadow-pop)] focus-visible:outline-none"
          style={{
            height: '64px',
            width: '64px',
            border: '4px solid var(--color-primary)',
          }}
        />
      </Slider.Root>
    </div>
  );
}
