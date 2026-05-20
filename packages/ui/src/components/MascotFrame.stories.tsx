import type { Meta, StoryObj } from '@storybook/react';
import { MascotFrame } from './MascotFrame';

const meta: Meta<typeof MascotFrame> = {
  title: 'Mascot/MascotFrame',
  component: MascotFrame,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Mascot character frame that surfaces the current reaction. Renders as a fixed-position card by default; stories override positioning via className for showcase.',
      },
    },
  },
  argTypes: {
    variant: { control: 'radio', options: ['milo', 'luna'] },
    reaction: {
      control: 'select',
      options: [
        'idle',
        'listening',
        'encouraging',
        'celebrating',
        'thinking',
        'gentle-hmm',
        'waving',
      ],
    },
  },
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', height: 200, width: 240 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof MascotFrame>;

const showcaseClass = 'static! relative! bottom-auto! left-auto!';

export const Idle: Story = {
  args: { variant: 'milo', reaction: 'idle', className: showcaseClass },
};

export const Listening: Story = {
  args: { variant: 'milo', reaction: 'listening', className: showcaseClass },
};

export const Encouraging: Story = {
  args: { variant: 'milo', reaction: 'encouraging', className: showcaseClass },
};

export const Celebrating: Story = {
  args: { variant: 'luna', reaction: 'celebrating', className: showcaseClass },
};

export const Thinking: Story = {
  args: { variant: 'luna', reaction: 'thinking', className: showcaseClass },
};

export const GentleHmm: Story = {
  args: { variant: 'milo', reaction: 'gentle-hmm', className: showcaseClass },
};

export const Waving: Story = {
  args: { variant: 'luna', reaction: 'waving', className: showcaseClass },
};
