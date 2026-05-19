import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  const settingsStore = new Map<string, unknown>();
  const setSettingMock = vi.fn(async (key: string, value: unknown) => {
    if (value === null) settingsStore.delete(key);
    else settingsStore.set(key, value);
  });
  const getSettingMock = vi.fn(async (key: string, fallback: unknown): Promise<unknown> => {
    return settingsStore.has(key) ? settingsStore.get(key) : fallback;
  });
  return { settingsStore, setSettingMock, getSettingMock };
});

vi.mock('@e4k/db', () => ({
  setSetting: (key: string, value: unknown) => hoisted.setSettingMock(key, value),
  getSetting: <T,>(key: string, fallback: T) =>
    hoisted.getSettingMock(key, fallback) as Promise<T>,
  getAllSettings: async () => Object.fromEntries(hoisted.settingsStore),
  db: {},
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
}));

import DeleteAllDataPage from './page';

void React;

const TYPING_TARGET = 'DELETE';

async function passMathGate(): Promise<void> {
  // The math gate shows two random operands; read them and answer.
  const equation = await screen.findByText(/\d+\s*\+\s*\d+\s*=\s*\?/);
  const text = equation.textContent ?? '';
  const match = text.match(/(\d+)\s*\+\s*(\d+)/);
  expect(match).not.toBeNull();
  const a = Number(match?.[1] ?? '0');
  const b = Number(match?.[2] ?? '0');
  const sum = String(a + b);

  for (const digit of sum) {
    fireEvent.click(screen.getByRole('button', { name: `Digit ${digit}` }));
  }
  fireEvent.click(screen.getByRole('button', { name: /Submit answer/i }));
}

describe('DeleteAllDataPage', () => {
  beforeEach(() => {
    hoisted.settingsStore.clear();
    hoisted.setSettingMock.mockClear();
    hoisted.getSettingMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('walks the 3-step delete flow and writes a scheduled-deletion record', async () => {
    render(<DeleteAllDataPage />);

    // Wait for the initial hydration so the form is in 'idle' state.
    await waitFor(() => {
      expect(
        screen.getByRole('checkbox', { name: /I understand this will delete all data/i }),
      ).toBeInTheDocument();
    });

    // Step 1: tick I understand.
    const checkbox = screen.getByRole('checkbox', {
      name: /I understand this will delete all data/i,
    });
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    // Step 2: type DELETE.
    const input = screen.getByLabelText(/Type DELETE to confirm/i);
    fireEvent.change(input, { target: { value: TYPING_TARGET } });

    // The Schedule deletion button should now be enabled.
    const scheduleBtn = screen.getByRole('button', { name: /Schedule deletion/i });
    expect(scheduleBtn).not.toBeDisabled();
    fireEvent.click(scheduleBtn);

    // Step 3: math gate opens.
    await passMathGate();

    // Banner appears with the scheduled date.
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Deletion scheduled/i })).toBeInTheDocument();
    });

    // The schedule record was written.
    const scheduledCall = hoisted.setSettingMock.mock.calls.find(
      (c) => c[0] === 'parent.deletion.scheduledFor',
    );
    expect(scheduledCall).toBeDefined();
    expect(typeof scheduledCall?.[1]).toBe('number');
    const scheduled = scheduledCall?.[1] as number;
    // 7 days ahead, ±10s of slack.
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(scheduled - (Date.now() + sevenDays))).toBeLessThan(10_000);
  });

  it('lets the parent cancel a previously scheduled deletion', async () => {
    hoisted.settingsStore.set('parent.deletion.scheduledFor', Date.now() + 86_400_000);
    render(<DeleteAllDataPage />);

    const cancelBtn = await screen.findByRole('button', { name: /Cancel deletion/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      const lastCall = hoisted.setSettingMock.mock.calls.find(
        (c) => c[0] === 'parent.deletion.scheduledFor' && c[1] === null,
      );
      expect(lastCall).toBeDefined();
    });
  });

  it('keeps the schedule button disabled until both gates are satisfied', async () => {
    render(<DeleteAllDataPage />);

    const scheduleBtn = await screen.findByRole('button', { name: /Schedule deletion/i });
    expect(scheduleBtn).toBeDisabled();

    // Only checkbox.
    fireEvent.click(
      screen.getByRole('checkbox', { name: /I understand this will delete all data/i }),
    );
    expect(scheduleBtn).toBeDisabled();

    // Only checkbox + wrong text.
    const input = screen.getByLabelText(/Type DELETE to confirm/i);
    fireEvent.change(input, { target: { value: 'delete' } }); // lowercase: must fail
    expect(scheduleBtn).toBeDisabled();

    // Correct.
    fireEvent.change(input, { target: { value: 'DELETE' } });
    expect(scheduleBtn).not.toBeDisabled();
  });
});

// Silence unused-import warning for `within`. Available for future tests.
void within;
