// SAFETY INVARIANTS (do NOT change without Safety Officer sign-off):
// - This is a parent-only control. Strictness shifts thresholds by ±10 but
//   the pronunciation scorer caps the try-again threshold so a passing band
//   is always reachable. Activities also auto-pass after 3 attempts.
// - Strictness NEVER affects whether the lesson can be completed — it only
//   tunes how often the kid hears "Great!" vs "Good try!" along the way.

'use client';

import type { Strictness } from '@e4k/audio';
import { getSetting, setSetting } from '@e4k/db';
import * as RadioGroup from '@radix-ui/react-radio-group';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';

const DEFAULT_STRICTNESS: Strictness = 'normal';

interface StrictnessOption {
  value: Strictness;
  label: string;
  description: string;
}

export interface StrictnessControlProps {
  className?: string;
}

export function StrictnessControl({ className }: StrictnessControlProps) {
  const labelId = useId();
  const t = useTranslations();
  const [value, setValue] = useState<Strictness>(DEFAULT_STRICTNESS);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [announce, setAnnounce] = useState<string>('');

  const options: ReadonlyArray<StrictnessOption> = [
    { value: 'easy', label: t('parent.strictnessEasy'), description: t('parent.strictnessEasyDesc') },
    { value: 'normal', label: t('parent.strictnessNormal'), description: t('parent.strictnessNormalDesc') },
    { value: 'strict', label: t('parent.strictnessStrict'), description: t('parent.strictnessStrictDesc') },
  ];

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await getSetting<Strictness>('pronunciation.strictness', DEFAULT_STRICTNESS);
      if (!cancelled) {
        setValue(stored);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = async (next: string) => {
    const v = next as Strictness;
    setValue(v);
    try {
      await setSetting('pronunciation.strictness', v);
      setAnnounce(t('parent.strictnessAnnounce', { value: v }));
    } catch {
      setAnnounce(t('common.couldNotSave'));
    }
  };

  if (!loaded) return null;

  return (
    <section
      aria-labelledby={labelId}
      className={
        className ??
        'flex w-full flex-col gap-[var(--space-3)] rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-[var(--space-3)]'
      }
    >
      <h3
        id={labelId}
        className="px-[var(--space-2)] text-lg text-[var(--color-primary-dark)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {t('parent.strictnessHeading')}
      </h3>
      <p className="px-[var(--space-2)] text-sm text-[var(--color-mist)]">
        {t('parent.strictnessDesc')}
      </p>
      <span aria-live="polite" className="sr-only">
        {announce}
      </span>
      <RadioGroup.Root
        aria-labelledby={labelId}
        value={value}
        onValueChange={(v) => void handleChange(v)}
        className="flex flex-col gap-[var(--space-2)]"
      >
        {options.map((opt) => (
          <RadioOption key={opt.value} option={opt} />
        ))}
      </RadioGroup.Root>
    </section>
  );
}

function RadioOption({ option }: { option: StrictnessOption }) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex w-full cursor-pointer items-center gap-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-4)] shadow-[var(--shadow-card)] transition-transform duration-[var(--motion-fast)] active:scale-[0.99]"
      style={{ minHeight: 'var(--tap-min-young)' }}
    >
      <RadioGroup.Item
        id={id}
        value={option.value}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-pill)] border-2 border-[var(--color-primary)] bg-[var(--color-surface-high)]"
      >
        <RadioGroup.Indicator className="block h-3 w-3 rounded-[var(--radius-pill)] bg-[var(--color-primary)]" />
      </RadioGroup.Item>
      <div className="flex flex-col">
        <span
          className="text-base text-[var(--color-ink)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {option.label}
        </span>
        <span className="text-sm text-[var(--color-mist)]">{option.description}</span>
      </div>
    </label>
  );
}
