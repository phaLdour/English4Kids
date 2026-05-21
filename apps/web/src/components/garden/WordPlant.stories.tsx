import type { Meta, StoryObj } from '@storybook/react';
import type { LeitnerBox } from '@e4k/game-engine';
import { WordPlant } from './WordPlant';

const meta: Meta<typeof WordPlant> = {
  title: 'Garden/WordPlant',
  component: WordPlant,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Reusable plant tile. Stage is derived from the Leitner box (1 → seed, 2 → sprout, 3 → bud, 4 → bloom, 5 → star). Bloom color is deterministic per word so the same word always blooms the same.',
      },
    },
    a11y: {
      config: {
        rules: [{ id: 'image-alt', enabled: true }],
      },
    },
  },
  argTypes: {
    box: {
      control: { type: 'inline-radio' },
      options: [1, 2, 3, 4, 5] satisfies LeitnerBox[],
    },
    size: { control: { type: 'number', min: 48, max: 200 } },
    word: { control: 'text' },
    onTap: { action: 'tapped' },
  },
};

export default meta;

type Story = StoryObj<typeof WordPlant>;

export const Seed: Story = {
  args: { word: 'milk', box: 1, size: 96 },
  parameters: {
    docs: {
      description: { story: 'Stage 1: a freshly seen word. Pulsing dot in soil.' },
    },
  },
};

export const Sprout: Story = {
  args: { word: 'water', box: 2, size: 96 },
  parameters: {
    docs: { description: { story: 'Stage 2: two tiny leaves break the ground.' } },
  },
};

export const Bud: Story = {
  args: { word: 'friend', box: 3, size: 96 },
  parameters: {
    docs: { description: { story: 'Stage 3: a closed bud appears on the stem.' } },
  },
};

export const Bloom: Story = {
  args: { word: 'sun', box: 4, size: 96 },
  parameters: {
    docs: { description: { story: "Stage 4: the flower opens in the word's signature color." } },
  },
};

export const Star: Story = {
  args: { word: 'hello', box: 5, size: 96 },
  parameters: {
    docs: {
      description: { story: 'Stage 5: mastered. The plant becomes a star in the night-sky band.' },
    },
  },
};

export const Tappable: Story = {
  args: { word: 'apple', box: 4, size: 96, onTap: (_w: string) => undefined },
  parameters: {
    docs: {
      description: {
        story:
          'When `onTap` is provided the tile becomes a button with a spring-scale press animation.',
      },
    },
  },
};
