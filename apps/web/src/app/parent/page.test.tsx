import '@/test-utils/mock-next-intl';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock @e4k/db with a controllable in-memory Dexie ---------------------
// vi.mock factories are hoisted, so the shared state must be set up via
// vi.hoisted() to be accessible inside the factory closure.

const fixtures = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const childrenRows: Row[] = [];
  const progressRows: Row[] = [];
  const vocabRows: Row[] = [];
  const pronRows: Row[] = [];
  const auditRows: Row[] = [];
  const settingsStore = new Map<string, unknown>();
  return { childrenRows, progressRows, vocabRows, pronRows, auditRows, settingsStore };
});

vi.mock('@e4k/db', () => {
  type Row = Record<string, unknown>;
  function whereChain<T extends Row>(rows: T[]) {
    return {
      where: (col: string) => ({
        equals: (val: unknown) => ({
          toArray: async () => rows.filter((r) => r[col] === val),
        }),
      }),
      toArray: async () => rows.slice(),
    };
  }
  return {
    db: {
      children: {
        ...whereChain(fixtures.childrenRows),
        toArray: async () => fixtures.childrenRows.slice(),
      },
      progress: whereChain(fixtures.progressRows),
      vocabState: whereChain(fixtures.vocabRows),
      pronunciationAttempts: whereChain(fixtures.pronRows),
      auditLog: {
        ...whereChain(fixtures.auditRows),
      },
    },
    getSetting: async <T,>(key: string, fallback: T): Promise<T> =>
      fixtures.settingsStore.has(key) ? (fixtures.settingsStore.get(key) as T) : fallback,
    setSetting: async (key: string, value: unknown) => {
      fixtures.settingsStore.set(key, value);
    },
    getAllSettings: async () => Object.fromEntries(fixtures.settingsStore),
  };
});

// Sister-subagent components — render them lightly to keep the test focused
// on the dashboard's own structure.
vi.mock('@/components/garden/WordGarden', () => ({
  WordGarden: ({ states }: { states: { word: string }[] }) => (
    <div data-testid="word-garden-mock">{states.length} words</div>
  ),
}));

vi.mock('@/components/streak/StreakPlant', () => ({
  StreakPlant: ({ current }: { current: number }) => (
    <div data-testid="streak-plant-mock">{current}-day streak mock</div>
  ),
}));

// Expose React on globalThis so JSX in the SUT (compiled to React.createElement
// by esbuild's classic transform) resolves at runtime. Sibling test files
// follow the same pattern.
(globalThis as { React?: typeof React }).React = React;

import ParentDashboardPage from './page';

describe('ParentDashboardPage', () => {
  beforeEach(() => {
    fixtures.childrenRows.length = 0;
    fixtures.progressRows.length = 0;
    fixtures.vocabRows.length = 0;
    fixtures.pronRows.length = 0;
    fixtures.auditRows.length = 0;
    fixtures.settingsStore.clear();

    fixtures.childrenRows.push({
      id: 'child-1',
      parent_id: '',
      nickname: 'Sunny Otter',
      avatar_key: 'sunny-otter',
      age_band: '6-8',
      birth_year: null,
      created_at: '2026-05-01T00:00:00.000Z',
      updated_at: '2026-05-01T00:00:00.000Z',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders all dashboard sections after hydration', async () => {
    render(<ParentDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Sunny Otter/i)).toBeInTheDocument();
    });

    // Today snapshot
    expect(screen.getByRole('heading', { name: /Today/i })).toBeInTheDocument();
    expect(screen.getByText(/Time today/i)).toBeInTheDocument();
    expect(screen.getByText(/Lessons today/i)).toBeInTheDocument();
    expect(screen.getByText(/New words/i)).toBeInTheDocument();
    expect(screen.getByText(/Speaking attempts/i)).toBeInTheDocument();

    // Weekly chart heading
    expect(screen.getByRole('heading', { name: /Past 7 days/i })).toBeInTheDocument();

    // Word Garden + Streak (mocked components)
    expect(screen.getByTestId('word-garden-mock')).toBeInTheDocument();
    expect(screen.getByTestId('streak-plant-mock')).toBeInTheDocument();

    // Empty-state copy for recent lessons (no progress rows in this test).
    expect(
      screen.getByText(/Start a lesson together to see your child/i),
    ).toBeInTheDocument();

    // Nav tiles
    expect(screen.getByText(/Child details/i)).toBeInTheDocument();
    expect(screen.getByText(/Data export/i)).toBeInTheDocument();
    expect(screen.getByText(/Delete all data/i)).toBeInTheDocument();
    expect(screen.getByText(/Account upgrade/i)).toBeInTheDocument();
  });

  it('shows the single MVP child in the ChildSwitcher', async () => {
    render(<ParentDashboardPage />);
    await waitFor(() => {
      expect(screen.getByRole('radiogroup', { name: /Choose a learner/i })).toBeInTheDocument();
    });
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBe(1);
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
  });

  it('shows the scheduled-deletion banner when a wipe is queued', async () => {
    fixtures.settingsStore.set('parent.deletion.scheduledFor', Date.now() + 86_400_000);
    render(<ParentDashboardPage />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Deletion scheduled for/i);
    });
  });
});
