import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useState } from 'react';
import { ParentGate, type ParentGateProps } from './ParentGate';

interface DemoProps extends Omit<ParentGateProps, 'open' | 'onOpenChange' | 'onPass'> {
  forceCooldown?: boolean;
}

function ParentGateDemo({ forceCooldown = false, ...rest }: DemoProps) {
  const [open, setOpen] = useState(true);
  const [passed, setPassed] = useState(false);

  // Force the dialog into a cooldown state by exhausting maxAttempts
  // when the story requests it. We do this by setting a tiny maxAttempts
  // and submitting bogus answers programmatically isn't possible without
  // refs, so we use a 0-attempt prop trick: maxAttempts=1, no-op submit
  // approach — instead we simulate via cooldownSeconds + maxAttempts.
  const propsForCooldown: Partial<ParentGateProps> = forceCooldown
    ? { maxAttempts: 1, cooldownSeconds: 30 }
    : {};

  useEffect(() => {
    if (!forceCooldown) return;
    // Click a wrong digit + submit via DOM after mount to trigger cooldown.
    const timer = window.setTimeout(() => {
      const digit = document.querySelector<HTMLButtonElement>(
        'button[aria-label="Digit 1"]',
      );
      const submit = document.querySelector<HTMLButtonElement>(
        'button[aria-label="Submit answer"]',
      );
      if (digit && submit) {
        digit.click();
        submit.click();
      }
    }, 100);
    return () => window.clearTimeout(timer);
  }, [forceCooldown]);

  return (
    <div style={{ minHeight: 480 }}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          padding: '12px 24px',
          borderRadius: 12,
          background: 'var(--color-primary)',
          color: 'var(--color-surface-high)',
          border: 'none',
          fontFamily: 'var(--font-display)',
        }}
      >
        Open ParentGate
      </button>
      {passed ? (
        <p style={{ marginTop: 24 }} role="status">
          Passed!
        </p>
      ) : null}
      <ParentGate
        {...rest}
        {...propsForCooldown}
        open={open}
        onOpenChange={setOpen}
        onPass={() => setPassed(true)}
      />
    </div>
  );
}

const meta: Meta<typeof ParentGateDemo> = {
  title: 'Safety/ParentGate',
  component: ParentGateDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Two-digit-addition gate that grown-ups must pass before any sensitive setting (microphone, parent dashboard, data export). Locks after `maxAttempts` failures for `cooldownSeconds` seconds.',
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof ParentGateDemo>;

export const Open: Story = {
  args: {
    title: 'Grown-ups only',
    description: 'Solve this to continue.',
  },
};

export const Cooldown: Story = {
  args: {
    title: 'Grown-ups only',
    description: 'Solve this to continue.',
    forceCooldown: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Simulates the cooldown state by triggering a wrong submission immediately after mount with maxAttempts=1.',
      },
    },
  },
};
