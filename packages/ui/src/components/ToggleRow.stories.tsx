import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ToggleRow, type ToggleRowProps } from './ToggleRow';

function ControlledToggle({ checked, onCheckedChange, ...rest }: ToggleRowProps) {
  const [internal, setInternal] = useState(checked);
  return (
    <div style={{ width: 480, maxWidth: '100%' }}>
      <ToggleRow
        {...rest}
        checked={internal}
        onCheckedChange={(next) => {
          setInternal(next);
          onCheckedChange?.(next);
        }}
      />
    </div>
  );
}

const meta: Meta<typeof ControlledToggle> = {
  title: 'Settings/ToggleRow',
  component: ControlledToggle,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Setting toggle row with label, optional description, and Radix Switch. Switch is 48px tall to meet young-learner touch targets.',
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof ControlledToggle>;

export const On: Story = {
  args: {
    label: 'Enable music',
    checked: true,
    onCheckedChange: () => {},
  },
};

export const Off: Story = {
  args: {
    label: 'Enable microphone',
    checked: false,
    onCheckedChange: () => {},
  },
};

export const WithDescription: Story = {
  args: {
    label: 'Enable microphone',
    description:
      'Audio stays on this device. No recordings are uploaded. A grown-up must unlock this setting.',
    checked: false,
    onCheckedChange: () => {},
  },
};
