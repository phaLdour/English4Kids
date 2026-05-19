import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { VolumeSlider, type VolumeSliderProps } from './VolumeSlider';

function ControlledVolume({ value, onChange, ...rest }: VolumeSliderProps) {
  const [internal, setInternal] = useState(value);
  return (
    <div style={{ width: 360, maxWidth: '100%' }}>
      <VolumeSlider
        {...rest}
        value={internal}
        onChange={(next) => {
          setInternal(next);
          onChange?.(next);
        }}
      />
    </div>
  );
}

const meta: Meta<typeof ControlledVolume> = {
  title: 'Settings/VolumeSlider',
  component: ControlledVolume,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Accessible volume slider built on Radix. Thumb is 64x64 to satisfy young-learner tap targets. Always pair with a meaningful label.',
      },
    },
  },
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 100, step: 1 } },
  },
};

export default meta;

type Story = StoryObj<typeof ControlledVolume>;

export const MasterEighty: Story = {
  name: 'Master 80%',
  args: { label: 'Master volume', value: 80, onChange: () => {} },
};

export const MusicSixty: Story = {
  name: 'Music 60%',
  args: { label: 'Music', value: 60, onChange: () => {} },
};

export const SfxEighty: Story = {
  name: 'SFX 80%',
  args: { label: 'Sound effects', value: 80, onChange: () => {} },
};

export const VoiceFull: Story = {
  name: 'Voice 100%',
  args: { label: 'Voice', value: 100, onChange: () => {} },
};
