'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '../utils/cn';

export interface ParentGateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPass: () => void;
  title?: string;
  description?: string;
  maxAttempts?: number;
  cooldownSeconds?: number;
  className?: string;
}

interface Problem {
  a: number;
  b: number;
  answer: number;
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateProblem(): Problem {
  const a = randomBetween(11, 49);
  const b = randomBetween(11, 49);
  return { a, b, answer: a + b };
}

export function ParentGate({
  open,
  onOpenChange,
  onPass,
  title = 'Grown-ups only',
  description = 'Solve this to continue.',
  maxAttempts = 3,
  cooldownSeconds = 60,
  className,
}: ParentGateProps) {
  const [problem, setProblem] = useState<Problem>(() => generateProblem());
  const [entry, setEntry] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (lockedUntil === null) return;
    const interval = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  useEffect(() => {
    if (open) {
      setProblem(generateProblem());
      setEntry('');
      setAttempts(0);
    }
  }, [open]);

  const remainingCooldown = useMemo(() => {
    if (lockedUntil === null) return 0;
    const diff = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
    if (diff === 0 && lockedUntil !== null) {
      setLockedUntil(null);
      setAttempts(0);
    }
    return diff;
  }, [lockedUntil]);

  const append = useCallback(
    (digit: string) => {
      if (remainingCooldown > 0) return;
      setEntry((prev) => (prev.length >= 3 ? prev : prev + digit));
    },
    [remainingCooldown],
  );

  const clear = useCallback(() => setEntry(''), []);

  const submit = useCallback(() => {
    if (remainingCooldown > 0 || entry.length === 0) return;
    const value = Number.parseInt(entry, 10);
    if (Number.isFinite(value) && value === problem.answer) {
      onPass();
      onOpenChange(false);
      return;
    }
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    setEntry('');
    if (nextAttempts >= maxAttempts) {
      setLockedUntil(Date.now() + cooldownSeconds * 1000);
    } else {
      setProblem(generateProblem());
    }
  }, [
    attempts,
    cooldownSeconds,
    entry,
    maxAttempts,
    onOpenChange,
    onPass,
    problem.answer,
    remainingCooldown,
  ]);

  const keypad: Array<string> = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'enter'];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 bg-[rgba(31,41,51,0.55)]"
          style={{ backdropFilter: 'blur(2px)' }}
        />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 w-[min(420px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-xl)] bg-[var(--color-surface-high)] p-[var(--space-6)] shadow-[var(--shadow-pop)]',
            className,
          )}
        >
          <Dialog.Title
            className="text-2xl text-[var(--color-primary-dark)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {title}
          </Dialog.Title>
          <Dialog.Description className="mt-[var(--space-2)] text-[var(--color-mist)]">
            {description}
          </Dialog.Description>

          {remainingCooldown > 0 ? (
            <p
              role="status"
              aria-live="assertive"
              className="mt-[var(--space-6)] text-center text-lg text-[var(--color-alert)]"
            >
              Please wait {remainingCooldown}s and try again.
            </p>
          ) : (
            <>
              <p
                className="mt-[var(--space-6)] text-center text-3xl text-[var(--color-ink)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {problem.a} + {problem.b} = ?
              </p>
              <div
                aria-live="polite"
                className="mx-auto mt-[var(--space-4)] flex h-16 w-32 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface)] text-3xl text-[var(--color-ink)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {entry || '—'}
              </div>
              <div className="mt-[var(--space-4)] grid grid-cols-3 gap-[var(--space-2)]">
                {keypad.map((key) => {
                  if (key === 'clear') {
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-label="Clear entry"
                        onClick={clear}
                        className="rounded-[var(--radius-md)] bg-[var(--color-coral)] text-[var(--color-ink)]"
                        style={{ minHeight: '64px', fontFamily: 'var(--font-display)' }}
                      >
                        Clear
                      </button>
                    );
                  }
                  if (key === 'enter') {
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-label="Submit answer"
                        onClick={submit}
                        className="rounded-[var(--radius-md)] bg-[var(--color-primary)] text-[var(--color-surface-high)]"
                        style={{ minHeight: '64px', fontFamily: 'var(--font-display)' }}
                      >
                        Enter
                      </button>
                    );
                  }
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-label={`Digit ${key}`}
                      onClick={() => append(key)}
                      className="rounded-[var(--radius-md)] bg-[var(--color-surface)] text-2xl text-[var(--color-ink)]"
                      style={{
                        minHeight: '64px',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {key}
                    </button>
                  );
                })}
              </div>
              {attempts > 0 ? (
                <p
                  role="status"
                  aria-live="polite"
                  className="mt-[var(--space-3)] text-center text-sm text-[var(--color-mist)]"
                >
                  {maxAttempts - attempts} attempt{maxAttempts - attempts === 1 ? '' : 's'} left.
                </p>
              ) : null}
            </>
          )}

          <Dialog.Close asChild>
            <button
              type="button"
              aria-label="Close"
              className="absolute right-[var(--space-3)] top-[var(--space-3)] flex items-center justify-center rounded-[var(--radius-pill)] bg-transparent text-[var(--color-mist)]"
              style={{ minHeight: '48px', minWidth: '48px' }}
            >
              <span aria-hidden="true" style={{ fontSize: '1.5rem', lineHeight: 1 }}>
                {'×'}
              </span>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
