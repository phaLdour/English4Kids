import type { Meta, StoryObj } from '@storybook/react';
import { TopBar } from './TopBar';

const meta: Meta<typeof TopBar> = {
  title: 'Navigation/TopBar',
  component: TopBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Top navigation bar. Provides Back + Settings actions with 64x64 touch targets. The minimal variant renders nothing so child screens can hide chrome.',
      },
    },
  },
  argTypes: {
    variant: { control: 'radio', options: ['default', 'minimal'] },
    title: { control: 'text' },
  },
};

export default meta;

type Story = StoryObj<typeof TopBar>;

export const Default: Story = {
  args: {
    title: 'Unit 1 · Lesson 1.1',
    variant: 'default',
  },
};

export const Minimal: Story = {
  args: {
    title: 'Hidden',
    variant: 'minimal',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Minimal variant renders nothing; useful for full-bleed onboarding and StarReveal screens.',
      },
    },
  },
};

export const LongTitle: Story = {
  args: {
    title: 'A Very Long Lesson Title That Should Be Truncated Cleanly',
    variant: 'default',
  },
};
