import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, type ReactElement } from 'react';
import { useMicStore } from '@/lib/mic-store';
import { MicIndicator } from './MicIndicator';

/**
 * Decorator factory that pins the global `useMicStore.active` flag so a story
 * can show the indicator in either state. We restore the previous value on
 * teardown so stories don't leak state into one another.
 */
function withMicActive(active: boolean) {
  return function Decorator(Story: () => ReactElement): ReactElement {
    useEffect(() => {
      const previous = useMicStore.getState().active;
      useMicStore.setState({ active });
      return () => {
        useMicStore.setState({ active: previous });
      };
    }, []);
    return <Story />;
  };
}

const meta: Meta<typeof MicIndicator> = {
  title: 'Safety/MicIndicator',
  component: MicIndicator,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Global mic-live indicator. Mounted in the root layout so any active STT session is **always** visible to the child. UI-only — does not touch `navigator.mediaDevices`.',
      },
    },
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'aria-live', enabled: true },
        ],
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof MicIndicator>;

export const Active: Story = {
  decorators: [withMicActive(true)],
  parameters: {
    docs: {
      description: {
        story: 'Mic session is active. Pulsing red dot + "Listening..." copy + Stop button.',
      },
    },
  },
};

export const Hidden: Story = {
  decorators: [withMicActive(false)],
  parameters: {
    docs: {
      description: {
        story:
          'No active session — the component returns `null`. Renders as empty space in Storybook.',
      },
    },
  },
  render: () => (
    <div
      style={{
        minHeight: 160,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-mist)',
        fontFamily: 'var(--font-display)',
      }}
    >
      <MicIndicator />
      <span>(no indicator rendered — mic is idle)</span>
    </div>
  ),
};
