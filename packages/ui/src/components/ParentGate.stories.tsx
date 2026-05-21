import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useState } from 'react';
import { ParentGate, type ParentGateProps } from './ParentGate';

interface DemoProps extends Omit<ParentGateProps, 'open' | 'onOpenChange' | 'onPass'> {
  /** How many wrong submissions to simulate after mount, 0 to 3. */
  wrongAttempts?: 0 | 1 | 2 | 3;
  /** Force the dialog into a solved/closed-after-pass state for the docs. */
  forceSolved?: boolean;
}

/**
 * Demo wrapper: drives the ParentGate through programmatic wrong submissions
 * so the docs site can render each state (one-wrong, two-wrong, cooldown,
 * solved) deterministically.
 */
function ParentGateDemo({ wrongAttempts = 0, forceSolved = false, ...rest }: DemoProps) {
  const [open, setOpen] = useState<boolean>(true);
  const [passed, setPassed] = useState<boolean>(false);

  // For the cooldown story we shrink maxAttempts so a single wrong submission
  // is enough to trigger the lockout.
  const propsOverride: Partial<ParentGateProps> =
    wrongAttempts === 3 ? { maxAttempts: 3, cooldownSeconds: 60 } : {};

  useEffect(() => {
    if (forceSolved) {
      // Synthesize a "solved" state by closing the dialog and flipping the
      // local passed flag. We do not poke at the gate internals; we just
      // show the after-success UX.
      const timer = window.setTimeout(() => {
        setPassed(true);
        setOpen(false);
      }, 80);
      return () => window.clearTimeout(timer);
    }
    if (wrongAttempts === 0) return undefined;
    // Click a digit + submit `wrongAttempts` times. The math problem is
    // randomized so the chosen digit is overwhelmingly wrong (answers live
    // between 22 and 98; the entry "1" cannot be the answer).
    const timers: number[] = [];
    for (let i = 0; i < wrongAttempts; i += 1) {
      timers.push(
        window.setTimeout(
          () => {
            const digit = document.querySelector<HTMLButtonElement>('button[aria-label="Digit 1"]');
            const submit = document.querySelector<HTMLButtonElement>(
              'button[aria-label="Submit answer"]',
            );
            if (digit && submit) {
              digit.click();
              submit.click();
            }
          },
          80 + i * 120,
        ),
      );
    }
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [forceSolved, wrongAttempts]);

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
      {passed ? <output style={{ marginTop: 24 }}>Passed!</output> : null}
      <ParentGate
        {...rest}
        {...propsOverride}
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
          'Two-digit-addition gate that grown-ups must pass before any sensitive setting (microphone, parent dashboard, data export). Locks after `maxAttempts` failures for `cooldownSeconds` seconds. The cooldown copy is always supportive — never punitive.',
      },
    },
    a11y: {
      config: {
        rules: [
          { id: 'dialog-name', enabled: true },
          { id: 'aria-required-children', enabled: true },
        ],
      },
    },
  },
  argTypes: {
    wrongAttempts: { control: { type: 'inline-radio' }, options: [0, 1, 2, 3] },
    maxAttempts: { control: { type: 'number', min: 1, max: 5 } },
    cooldownSeconds: { control: { type: 'number', min: 10, max: 120 } },
  },
};

export default meta;

type Story = StoryObj<typeof ParentGateDemo>;

export const Open: Story = {
  args: {
    title: 'Grown-ups only',
    description: 'Solve this to continue.',
    wrongAttempts: 0,
  },
};

export const Attempt1Wrong: Story = {
  args: {
    title: 'Grown-ups only',
    description: 'Solve this to continue.',
    wrongAttempts: 1,
  },
  parameters: {
    docs: {
      description: {
        story: 'One wrong submission. Encouraging copy: "2 attempts left." No lockout yet.',
      },
    },
  },
};

export const Attempt2Wrong: Story = {
  args: {
    title: 'Grown-ups only',
    description: 'Solve this to continue.',
    wrongAttempts: 2,
  },
  parameters: {
    docs: {
      description: {
        story: 'Two wrong submissions. Still no lockout — one attempt remains.',
      },
    },
  },
};

export const Cooldown: Story = {
  args: {
    title: 'Grown-ups only',
    description: 'Solve this to continue.',
    wrongAttempts: 3,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Three wrong submissions in a row triggers a 60-second lockout. The keypad is disabled and a `role="status"` countdown is announced live.',
      },
    },
  },
};

export const Solved: Story = {
  args: {
    title: 'Grown-ups only',
    description: 'Solve this to continue.',
    forceSolved: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'After a successful submission the dialog auto-closes and the host page renders its post-gate UI. This story shows the "Passed!" status that consumers typically replace with the gated content.',
      },
    },
  },
};
