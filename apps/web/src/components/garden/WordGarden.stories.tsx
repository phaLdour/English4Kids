import type { Meta, StoryObj } from '@storybook/react';
import type { LeitnerBox } from '@e4k/game-engine';
import { WordGarden, type WordGardenState } from './WordGarden';

const meta: Meta<typeof WordGarden> = {
  title: 'Garden/WordGarden',
  component: WordGarden,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "The Word Garden visualizes a child's spaced-repetition state. Visual mode shows plants growing through Leitner boxes; list mode is a read-only grid for the parent dashboard.",
      },
    },
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'landmark-one-main', enabled: false },
          { id: 'aria-allowed-attr', enabled: true },
        ],
      },
    },
  },
  argTypes: {
    view: { control: 'radio', options: ['visual', 'list'] },
    onPlantTap: { action: 'plant-tapped' },
  },
};

export default meta;

type Story = StoryObj<typeof WordGarden>;

const SAMPLE_WORDS: ReadonlyArray<[string, LeitnerBox]> = [
  ['hello', 5],
  ['cat', 5],
  ['dog', 4],
  ['sun', 4],
  ['blue', 3],
  ['red', 3],
  ['water', 2],
  ['apple', 2],
  ['milk', 1],
  ['book', 1],
  ['friend', 3],
  ['big', 2],
];

const MIXED_STATES: WordGardenState[] = SAMPLE_WORDS.map(([word, box], idx) => ({
  word,
  box,
  // Stagger last-practiced timestamps so the list mode shows variety.
  lastPracticedAt: new Date(Date.UTC(2025, 4, 15 - idx)),
}));

export const VisualMixed: Story = {
  args: { states: MIXED_STATES, view: 'visual' },
  parameters: {
    docs: {
      description: {
        story:
          'Visual mode with a mixed Leitner distribution: two mastered words at the top, the rest growing through boxes 1–4 below.',
      },
    },
  },
};

export const VisualMasteredOnly: Story = {
  args: {
    states: SAMPLE_WORDS.filter(([, box]) => box === 5).map(([word, box]) => ({
      word,
      box,
      lastPracticedAt: new Date(Date.UTC(2025, 4, 15)),
    })),
    view: 'visual',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Edge case: every word is mastered. The growing-words area shows the placeholder copy.',
      },
    },
  },
};

export const VisualEmpty: Story = {
  args: { states: [], view: 'visual' },
  parameters: {
    docs: {
      description: {
        story:
          'No words planted yet — both bands show placeholder copy that nudges the child to start a lesson.',
      },
    },
  },
};

export const ListMode: Story = {
  args: { states: MIXED_STATES, view: 'list' },
  parameters: {
    docs: {
      description: {
        story:
          'List mode (parent dashboard). Read-only table of every word, its Leitner stage, and the last-practice date.',
      },
    },
  },
};
