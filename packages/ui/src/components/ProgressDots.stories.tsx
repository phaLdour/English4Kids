import type { Meta, StoryObj } from '@storybook/react';
import { ProgressDots } from './ProgressDots';

const meta: Meta<typeof ProgressDots> = {
  title: 'Navigation/ProgressDots',
  component: ProgressDots,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Activity progress indicator. Uses ARIA progressbar role with clamped values so screen readers always announce the current step.',
      },
    },
  },
  argTypes: {
    total: { control: { type: 'number', min: 1, max: 12 } },
    current: { control: { type: 'number', min: 0, max: 12 } },
  },
};

export default meta;

type Story = StoryObj<typeof ProgressDots>;

export const FourDotsCurrentTwo: Story = {
  args: { total: 4, current: 2 },
};

export const SixDotsCurrentSix: Story = {
  args: { total: 6, current: 6 },
};

export const ThreeDotsCurrentOne: Story = {
  args: { total: 3, current: 1 },
};
