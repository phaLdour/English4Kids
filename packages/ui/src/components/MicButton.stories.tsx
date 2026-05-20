import type { Meta, StoryObj } from '@storybook/react';
import { MicButton } from './MicButton';

const meta: Meta<typeof MicButton> = {
  title: 'Activities/MicButton',
  component: MicButton,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Mic press-to-talk button. **UI-only:** this component does NOT call `getUserMedia`. The audio package wires the actual recorder behind the ParentGate.',
      },
    },
  },
  argTypes: {
    state: {
      control: 'radio',
      options: ['idle', 'listening', 'processing', 'disabled'],
    },
    size: { control: 'radio', options: ['young', 'old'] },
  },
};

export default meta;

type Story = StoryObj<typeof MicButton>;

export const Idle: Story = {
  args: { state: 'idle', size: 'young' },
};

export const Listening: Story = {
  args: { state: 'listening', size: 'young' },
};

export const ProcessingYoung: Story = {
  name: 'Processing (Young 6–8, 96px)',
  args: { state: 'processing', size: 'young' },
};

export const IdleOlder: Story = {
  name: 'Idle (Older 9–12, 72px)',
  args: { state: 'idle', size: 'old' },
};
