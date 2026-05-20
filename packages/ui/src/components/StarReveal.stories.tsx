import type { Meta, StoryObj } from '@storybook/react';
import { StarReveal } from './StarReveal';

const meta: Meta<typeof StarReveal> = {
  title: 'Activities/StarReveal',
  component: StarReveal,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'End-of-lesson reward screen. 1–3 stars animate in with a small spring; respects prefers-reduced-motion.',
      },
    },
  },
  argTypes: {
    count: { control: { type: 'inline-radio' }, options: [1, 2, 3] },
    wasReplay: { control: 'boolean' },
  },
};

export default meta;

type Story = StoryObj<typeof StarReveal>;

export const OneStar: Story = {
  args: { count: 1, wasReplay: false },
};

export const TwoStars: Story = {
  args: { count: 2, wasReplay: false },
};

export const ThreeStars: Story = {
  args: { count: 3, wasReplay: false },
};

export const ThreeStarsReplay: Story = {
  name: 'Three Stars (Replay — Made it Shine!)',
  args: { count: 3, wasReplay: true },
  parameters: {
    docs: {
      description: {
        story:
          'When a learner replays a lesson and reaches 3 stars, the headline switches to "Made it Shine!" to reinforce mastery without shaming the first attempt.',
      },
    },
  },
};
