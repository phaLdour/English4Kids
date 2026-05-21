import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useState } from 'react';
import { ParentGate } from '@e4k/ui';
import { StrictnessControl } from './StrictnessControl';

const meta: Meta<typeof StrictnessControl> = {
  title: 'Parent/StrictnessControl',
  component: StrictnessControl,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Parent-only pronunciation strictness control. Strictness shifts the scorer band thresholds by ±10 but never blocks lesson completion — activities auto-pass after 3 attempts regardless of band. Wired to Dexie via `getSetting`/`setSetting`.',
      },
    },
    a11y: {
      config: {
        rules: [
          { id: 'aria-labelled-by', enabled: true },
          { id: 'color-contrast', enabled: true },
        ],
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof StrictnessControl>;

export const Easy: Story = {
  name: 'Easy (selected)',
  parameters: {
    docs: {
      description: {
        story:
          'Gentlest scoring band. Best for new speakers. The selection persists immediately to Dexie on click.',
      },
    },
  },
};

export const Normal: Story = {
  name: 'Normal (default)',
  parameters: {
    docs: {
      description: {
        story: 'Balanced scoring band — the default for most kids.',
      },
    },
  },
};

export const Strict: Story = {
  name: 'Strict (selected)',
  parameters: {
    docs: {
      description: {
        story: 'Tightest scoring band. Best for confident speakers.',
      },
    },
  },
};

/**
 * Composition demo: in production, the StrictnessControl is rendered inside
 * the parent dashboard which is itself gated behind the ParentGate. This
 * story shows the typical flow: the gate first, then the control.
 */
function LockedDemo() {
  const [open, setOpen] = useState<boolean>(true);
  const [unlocked, setUnlocked] = useState<boolean>(false);
  useEffect(() => {
    setOpen(true);
  }, []);
  return (
    <div style={{ minHeight: 480, width: '100%', maxWidth: 480 }}>
      {unlocked ? (
        <StrictnessControl />
      ) : (
        <p
          style={{
            padding: 'var(--space-4)',
            background: 'var(--color-surface-high)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--color-mist)',
            fontFamily: 'var(--font-display)',
          }}
        >
          The strictness control is locked behind the ParentGate. Solve the math problem to
          continue.
        </p>
      )}
      <ParentGate
        open={open}
        onOpenChange={setOpen}
        onPass={() => {
          setUnlocked(true);
          setOpen(false);
        }}
        title="Grown-ups only"
        description="Solve this to adjust strictness."
      />
    </div>
  );
}

export const LockedBehindGate: StoryObj<typeof LockedDemo> = {
  name: 'Locked behind ParentGate',
  render: () => <LockedDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'Real-world composition: the control is gated. Solving the math problem reveals the radio group.',
      },
    },
  },
};
