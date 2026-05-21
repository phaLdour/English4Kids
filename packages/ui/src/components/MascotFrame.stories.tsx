import type { Meta, StoryObj } from '@storybook/react';
import { useEffect } from 'react';
import { MascotFrame, type MascotReaction, type MascotVariant } from './MascotFrame';

const meta: Meta<typeof MascotFrame> = {
  title: 'Mascot/MascotFrame',
  component: MascotFrame,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Mascot character frame that surfaces the current reaction. Renders as a fixed-position card by default; stories override positioning via className for showcase. Two variants × seven reactions. Honors `prefers-reduced-motion` and falls back gracefully when the Lottie JSON 404s.',
      },
    },
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'aria-roles', enabled: true },
          { id: 'image-alt', enabled: true },
        ],
      },
    },
  },
  argTypes: {
    variant: { control: 'radio', options: ['milo', 'luna'] satisfies MascotVariant[] },
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
      ] satisfies MascotReaction[],
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

const VARIANTS: MascotVariant[] = ['milo', 'luna'];
const REACTIONS: MascotReaction[] = [
  'idle',
  'listening',
  'encouraging',
  'celebrating',
  'thinking',
  'gentle-hmm',
  'waving',
];

// ---- 2 × 7 = 14 generated stories ----

function storyFor(variant: MascotVariant, reaction: MascotReaction): Story {
  return {
    args: { variant, reaction, className: showcaseClass },
  };
}

export const MiloIdle: Story = storyFor('milo', 'idle');
export const MiloListening: Story = storyFor('milo', 'listening');
export const MiloEncouraging: Story = storyFor('milo', 'encouraging');
export const MiloCelebrating: Story = storyFor('milo', 'celebrating');
export const MiloThinking: Story = storyFor('milo', 'thinking');
export const MiloGentleHmm: Story = storyFor('milo', 'gentle-hmm');
export const MiloWaving: Story = storyFor('milo', 'waving');

export const LunaIdle: Story = storyFor('luna', 'idle');
export const LunaListening: Story = storyFor('luna', 'listening');
export const LunaEncouraging: Story = storyFor('luna', 'encouraging');
export const LunaCelebrating: Story = storyFor('luna', 'celebrating');
export const LunaThinking: Story = storyFor('luna', 'thinking');
export const LunaGentleHmm: Story = storyFor('luna', 'gentle-hmm');
export const LunaWaving: Story = storyFor('luna', 'waving');

// Sanity ensure the cartesian product matches the 14 we listed.
const _expected: number = VARIANTS.length * REACTIONS.length;
if (_expected !== 14) {
  // Compile-time-ish guard so reviewers notice if someone adds a variant or
  // reaction without expanding the grid.
  throw new Error(`MascotFrame story matrix expected 14 entries, got ${_expected}`);
}

// ---- ReducedMotion: forces static fallback by mocking matchMedia. ----
//
// The mock is scoped per-story via a decorator so it does NOT bleed into the
// other stories in this file. We restore the original implementation on
// teardown.

interface MatchMediaMock {
  matches: boolean;
  media: string;
  addEventListener: (type: 'change', listener: () => void) => void;
  removeEventListener: (type: 'change', listener: () => void) => void;
  // Legacy API some libraries still call.
  addListener: (listener: () => void) => void;
  removeListener: (listener: () => void) => void;
  onchange: null;
  dispatchEvent: () => boolean;
}

function buildReducedMotionMatchMedia(): (q: string) => MatchMediaMock {
  return (query: string): MatchMediaMock => ({
    matches: query.includes('prefers-reduced-motion: reduce'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    onchange: null,
    dispatchEvent: () => false,
  });
}

export const ReducedMotion: Story = {
  args: { variant: 'milo', reaction: 'celebrating', className: showcaseClass },
  parameters: {
    docs: {
      description: {
        story:
          'When `prefers-reduced-motion: reduce` is set, the Lottie animation is replaced with the colored pill + mascot name. Verifies the A11y contract (no motion playback under reduced-motion).',
      },
    },
  },
  decorators: [
    (Story) => {
      // Patch matchMedia before the component mounts so the
      // usePrefersReducedMotion hook reads `true`.
      const original = typeof window === 'undefined' ? null : window.matchMedia;
      if (typeof window !== 'undefined') {
        window.matchMedia = buildReducedMotionMatchMedia() as unknown as typeof window.matchMedia;
      }
      // biome-ignore lint/correctness/useExhaustiveDependencies: `original` is captured at decorator-render time; the cleanup must restore that exact reference, not re-read from window
      useEffect(() => {
        return () => {
          if (typeof window !== 'undefined' && original) {
            window.matchMedia = original;
          }
        };
      }, []);
      return (
        <div style={{ position: 'relative', height: 200, width: 240 }}>
          <Story />
        </div>
      );
    },
  ],
};

// ---- FetchFail: mocks fetch to return 404 for the Lottie endpoint. ----
//
// Validates the graceful fallback path when the animation JSON is missing
// (offline, asset not yet authored, etc). Scoped to this story.

export const FetchFail: Story = {
  args: { variant: 'luna', reaction: 'waving', className: showcaseClass },
  parameters: {
    docs: {
      description: {
        story:
          'When `/lottie/luna-waving.json` returns 404, the component falls back to the static pill. No console errors should bubble up to the user.',
      },
    },
  },
  decorators: [
    (Story) => {
      const original = typeof window === 'undefined' ? null : window.fetch;
      if (typeof window !== 'undefined') {
        window.fetch = (async (input: RequestInfo | URL) => {
          const url = typeof input === 'string' ? input : input.toString();
          if (url.includes('/lottie/')) {
            return new Response(null, { status: 404, statusText: 'Not Found' });
          }
          if (!original) {
            return new Response(null, { status: 200 });
          }
          return original(input);
        }) as typeof window.fetch;
      }
      // biome-ignore lint/correctness/useExhaustiveDependencies: `original` is captured at decorator-render time; the cleanup must restore that exact reference
      useEffect(() => {
        return () => {
          if (typeof window !== 'undefined' && original) {
            window.fetch = original;
          }
        };
      }, []);
      return (
        <div style={{ position: 'relative', height: 200, width: 240 }}>
          <Story />
        </div>
      );
    },
  ],
};
