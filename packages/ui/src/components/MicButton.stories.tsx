import type { Meta, StoryObj } from '@storybook/react';
import { MicButton, type MicButtonSize, type MicButtonState } from './MicButton';

const meta: Meta<typeof MicButton> = {
  title: 'Activities/MicButton',
  component: MicButton,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Mic press-to-talk button. **UI-only:** this component does NOT call `getUserMedia` and does NOT instantiate `MediaRecorder`. The audio package wires the actual recorder behind the ParentGate (see SAFETY INVARIANTS in `useMicSession`). The `success` state from the spec is intentionally not implemented yet — Spek It! drives the celebration via `EncouragementBanner` + mascot reaction instead, so this story file omits a Success entry.',
      },
    },
    a11y: {
      config: {
        rules: [
          { id: 'button-name', enabled: true },
          { id: 'aria-pressed', enabled: true },
          { id: 'color-contrast', enabled: true },
        ],
      },
    },
  },
  argTypes: {
    state: {
      control: 'radio',
      options: ['idle', 'listening', 'processing', 'disabled'] satisfies MicButtonState[],
    },
    size: {
      control: 'radio',
      options: ['young', 'old'] satisfies MicButtonSize[],
    },
    label: { control: 'text' },
    onPress: { action: 'pressed' },
  },
};

export default meta;

type Story = StoryObj<typeof MicButton>;

export const Idle: Story = {
  args: { state: 'idle', size: 'young', label: 'Tap to talk' },
};

export const Listening: Story = {
  args: { state: 'listening', size: 'young', label: 'Listening, tap to stop' },
  parameters: {
    docs: {
      description: {
        story: 'Pulsing waveform + the red mic-live dot in the top-right corner.',
      },
    },
  },
};

export const Processing: Story = {
  args: { state: 'processing', size: 'young', label: 'Processing...' },
  parameters: {
    docs: {
      description: {
        story:
          'Soft spinner-like dots while the STT adapter resolves a result. `aria-busy="true"` is set.',
      },
    },
  },
};

export const Disabled: Story = {
  args: { state: 'disabled', size: 'young', label: 'Microphone is off' },
  parameters: {
    docs: {
      description: {
        story:
          'Used when the parent has turned the microphone off via Settings + ParentGate. The button is fully inert and visually muted.',
      },
    },
  },
};

export const Young: Story = {
  args: { state: 'idle', size: 'young', label: 'Tap to talk' },
  parameters: {
    docs: {
      description: {
        story: '6–8 age band: 96px diameter to honor the larger tap-target token.',
      },
    },
  },
};

export const Older: Story = {
  args: { state: 'idle', size: 'old', label: 'Tap to talk' },
  parameters: {
    docs: {
      description: {
        story: '9–12 age band: 72px diameter.',
      },
    },
  },
};
