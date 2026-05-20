import type { Meta, StoryObj } from '@storybook/react';
import { StreakPlant } from './StreakPlant';

const meta: Meta<typeof StreakPlant> = {
  title: 'Streak/StreakPlant',
  component: StreakPlant,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          "A growing plant that visualizes the child's streak. Welcoming at 0 (a new sapling), celebratory as days accumulate. Streaks cannot be lost punitively — missed days are softened by streak freezes.",
      },
    },
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'image-alt', enabled: true },
        ],
      },
    },
  },
  argTypes: {
    current: { control: { type: 'number', min: 0, max: 60 } },
    longest: { control: { type: 'number', min: 0, max: 365 } },
    freezesAvailable: { control: { type: 'number', min: 0, max: 3 } },
    variant: { control: 'radio', options: ['home', 'detail'] },
  },
};

export default meta;

type Story = StoryObj<typeof StreakPlant>;

export const NewPlant: Story = {
  args: { current: 0, longest: 0, freezesAvailable: 0, variant: 'home' },
  parameters: {
    docs: {
      description: {
        story:
          'Tier 1: no streak yet. The plant is rendered as a small seed bud and the copy welcomes the child instead of shaming them.',
      },
    },
  },
};

export const OneDay: Story = {
  args: { current: 1, longest: 1, freezesAvailable: 0, variant: 'home' },
  parameters: {
    docs: {
      description: {
        story: 'Tier 2: first day. A single leaf appears on the stem.',
      },
    },
  },
};

export const SevenDays: Story = {
  args: { current: 7, longest: 7, freezesAvailable: 0, variant: 'home' },
  parameters: {
    docs: {
      description: {
        story: 'Tier 3: one-week streak. Seven leaves on alternating sides of the stem.',
      },
    },
  },
};

export const FourteenDays: Story = {
  args: { current: 14, longest: 21, freezesAvailable: 0, variant: 'detail' },
  parameters: {
    docs: {
      description: {
        story:
          'Tier 4: two-week streak shown in the detail (parent-dashboard) variant. The longer card includes the "longest streak" subtitle.',
      },
    },
  },
};

export const ThirtyDays: Story = {
  args: { current: 30, longest: 30, freezesAvailable: 0, variant: 'detail' },
  parameters: {
    docs: {
      description: {
        story: 'Tier 5: fully grown. After 30 days the plant holds its full visual form.',
      },
    },
  },
};

export const FreezeActive: Story = {
  args: { current: 7, longest: 14, freezesAvailable: 2, variant: 'detail' },
  parameters: {
    docs: {
      description: {
        story:
          'A 7-day streak with two freezes available. Freeze badges are rendered next to the streak count and announced in the aria-label.',
      },
    },
  },
};
