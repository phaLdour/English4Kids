import '@/test-utils/mock-next-intl';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { WordGarden, type WordGardenState } from './WordGarden';

(globalThis as { React?: typeof React }).React = React;

const sampleStates: WordGardenState[] = [
  { word: 'hello', box: 1 },
  { word: 'hi', box: 2 },
  { word: 'bye', box: 3 },
  { word: 'morning', box: 4 },
  { word: 'thanks', box: 5, lastPracticedAt: new Date('2026-04-15T00:00:00Z') },
];

describe('WordGarden', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders 5 plants in visual mode with correct stages', () => {
    render(<WordGarden states={sampleStates} view="visual" />);
    expect(screen.getByLabelText(/hello, seed/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hi, sprout/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/bye, bud/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/morning, bloom/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/thanks, mastered/i)).toBeInTheDocument();
  });

  it('renders 5 rows in list mode with stage names', () => {
    render(<WordGarden states={sampleStates} view="list" />);
    const rows = screen.getAllByRole('row');
    // Header row + 5 data rows = 6 total in the table.
    expect(rows.length).toBe(6);
    // Each word appears as a cell.
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.getByText('hi')).toBeInTheDocument();
    expect(screen.getByText('bye')).toBeInTheDocument();
    expect(screen.getByText('morning')).toBeInTheDocument();
    expect(screen.getByText('thanks')).toBeInTheDocument();
    // Stage names shown.
    expect(screen.getByText('Seed')).toBeInTheDocument();
    expect(screen.getByText('Sprout')).toBeInTheDocument();
    expect(screen.getByText('Bud')).toBeInTheDocument();
    expect(screen.getByText('Bloom')).toBeInTheDocument();
    expect(screen.getByText('Star')).toBeInTheDocument();
  });

  it('renders empty state in visual mode when no words', () => {
    render(<WordGarden states={[]} view="visual" />);
    expect(screen.getByText(/play a lesson to plant/i)).toBeInTheDocument();
  });
});
