import type { Meta, StoryObj } from '@storybook/react';
import { TapCard } from './TapCard';

const meta: Meta<typeof TapCard> = {
  title: 'Activities/TapCard',
  component: TapCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Picture-card target for Listen & Tap activities. Two sizes: "young" (6–8, ~160px box, 80px+ tap region) and "old" (9–12, ~120px box, 56px+).',
      },
    },
    a11y: {
      config: {
        rules: [
          { id: 'button-name', enabled: true },
          { id: 'color-contrast', enabled: true },
        ],
      },
    },
  },
  argTypes: {
    size: { control: 'radio', options: ['young', 'old'] },
    state: { control: 'radio', options: ['idle', 'correct', 'wrong'] },
  },
};

export default meta;

type Story = StoryObj<typeof TapCard>;

export const Idle: Story = {
  args: {
    label: 'dog',
    isCorrect: true,
    size: 'young',
    state: 'idle',
  },
};

export const Correct: Story = {
  args: {
    label: 'dog',
    isCorrect: true,
    size: 'young',
    state: 'correct',
  },
};

export const Wrong: Story = {
  args: {
    label: 'cat',
    isCorrect: false,
    size: 'young',
    state: 'wrong',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Wrong-tap surfaces a non-shaming visual nudge. Copy and audio belong to EncouragementBanner/audio layer, not this card.',
      },
    },
  },
};

export const IdleOlder: Story = {
  name: 'Idle (Older 9–12, 56px tap)',
  args: {
    label: 'apple',
    isCorrect: true,
    size: 'old',
    state: 'idle',
  },
};
