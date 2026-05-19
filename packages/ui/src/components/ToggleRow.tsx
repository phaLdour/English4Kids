'use client';

import * as Switch from '@radix-ui/react-switch';
import { useId } from 'react';
import { cn } from '../utils/cn';

export interface ToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled = false,
  className,
}: ToggleRowProps) {
  const id = useId();
  const descId = description ? `${id}-desc` : undefined;

  return (
    <div
      className={cn(
        'flex w-full items-center justify-between gap-[var(--space-4)] rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-4)] shadow-[var(--shadow-card)]',
        className,
      )}
    >
      <div className="flex flex-col gap-[var(--space-1)]">
        <label
          htmlFor={id}
          className="text-base text-[var(--color-ink)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {label}
        </label>
        {description ? (
          <p id={descId} className="text-sm text-[var(--color-mist)]">
            {description}
          </p>
        ) : null}
      </div>
      <Switch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={descId}
        className="relative inline-flex h-10 w-20 shrink-0 cursor-pointer items-center rounded-[var(--radius-pill)] transition-colors duration-[var(--motion-fast)] disabled:opacity-50"
        style={{
          backgroundColor: checked ? 'var(--color-success)' : 'var(--color-muted)',
          minHeight: '48px',
          minWidth: '80px',
        }}
      >
        <Switch.Thumb
          className="block h-8 w-8 translate-x-1 rounded-[var(--radius-pill)] bg-[var(--color-surface-high)] shadow-[var(--shadow-card)] transition-transform duration-[var(--motion-fast)] data-[state=checked]:translate-x-11"
        />
      </Switch.Root>
    </div>
  );
}
