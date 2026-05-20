import type { Meta, StoryObj } from '@storybook/react';
import { EncouragementBanner } from './EncouragementBanner';

const meta: Meta<typeof EncouragementBanner> = {
  title: 'Activities/EncouragementBanner',
  component: EncouragementBanner,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Surfaces a single line of process-praise. **Runtime safety:** any message containing banned fragments (e.g. "wrong", "failed", "bad job") throws in development. Stories below pass; intentionally-bad copy is rejected at compile-time by content review, not Storybook.',
      },
    },
  },
  argTypes: {
    tone: { control: 'radio', options: ['encouraging', 'celebrating', 'gentle'] },
    message: { control: 'text' },
  },
};

export default meta;

type Story = StoryObj<typeof EncouragementBanner>;

export const Default: Story = {
  args: { message: 'You got it!', tone: 'encouraging' },
};

export const Celebrating: Story = {
  args: { message: 'Your brain is growing!', tone: 'celebrating' },
};

export const Gentle: Story = {
  args: { message: 'Almost — try again!', tone: 'gentle' },
};

export const CustomProcessPraise: Story = {
  args: {
    message: 'I love how carefully you listened.',
    tone: 'encouraging',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Process praise focuses on the learner\'s effort, not the outcome. Pedagogy team owns the canonical list.',
      },
    },
  },
};
