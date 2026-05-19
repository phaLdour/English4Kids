import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
      auditLog: whereChain(fixtures.auditRows),
    },
    getAllSettings: async () => Object.fromEntries(fixtures.settingsStore),
    getSetting: async <T,>(key: string, fallback: T): Promise<T> =>
      fixtures.settingsStore.has(key) ? (fixtures.settingsStore.get(key) as T) : fallback,
    setSetting: async (key: string, value: unknown) => {
      fixtures.settingsStore.set(key, value);
    },
  };
});

// Capture the Blob payload + filename triggered by the download.
let capturedJson: string | null = null;
let capturedFilename: string | null = null;
let capturedMime: string | null = null;
const originalCreateObjectURL = global.URL.createObjectURL;
const originalRevokeObjectURL = global.URL.revokeObjectURL;

// Expose React on globalThis so JSX in the SUT (compiled to React.createElement
// by esbuild's classic transform) resolves at runtime. Sibling test files
// follow the same pattern.
(globalThis as { React?: typeof React }).React = React;

import DataExportPage, { buildExportFilename, buildExportPayload } from './page';

describe('DataExportPage', () => {
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
    fixtures.progressRows.push({
      id: 'p1',
      child_id: 'child-1',
      lesson_id: 'lesson-1',
      status: 'completed',
      stars: 3,
      best_score: 90,
      attempts_count: 1,
      last_attempt_at: '2026-05-18T00:00:00.000Z',
      created_at: '2026-05-18T00:00:00.000Z',
      updated_at: '2026-05-18T00:00:00.000Z',
    });
    fixtures.settingsStore.set('age.band', '6-8');

    capturedJson = null;
    capturedFilename = null;
    capturedMime = null;

    // Stub URL.createObjectURL to capture the Blob payload.
    global.URL.createObjectURL = vi.fn((blob: Blob) => {
      capturedMime = blob.type;
      // Read the blob into a string for assertion.
      return 'blob:mock';
    }) as unknown as typeof global.URL.createObjectURL;
    global.URL.revokeObjectURL = vi.fn() as unknown as typeof global.URL.revokeObjectURL;

    // Intercept anchor.click() to read .download + capture JSON via Blob.text().
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = origCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') {
        const anchor = el as HTMLAnchorElement;
        const origClick = anchor.click.bind(anchor);
        anchor.click = () => {
          capturedFilename = anchor.download;
          origClick();
        };
      }
      return el;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.URL.createObjectURL = originalCreateObjectURL;
    global.URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('buildExportFilename produces the expected pattern', () => {
    const fixed = new Date('2026-05-19T10:00:00.000Z');
    const fn = buildExportFilename('Sunny Otter', fixed);
    expect(fn).toMatch(/^e4k-export-Sunny-Otter-2026-05-19\.json$/);
  });

  it('buildExportPayload contains all top-level schema keys', () => {
    const payload = buildExportPayload({
      child: null,
      progress: [],
      vocab: [],
      pronunciation: [],
      auditLog: [],
      settings: {},
    });
    expect(payload.schema).toBe('e4k-export-v1');
    expect(typeof payload.exportedAt).toBe('string');
    expect(payload).toHaveProperty('child');
    expect(payload).toHaveProperty('progress');
    expect(payload).toHaveProperty('vocab');
    expect(payload).toHaveProperty('pronunciation');
    expect(payload).toHaveProperty('auditLog');
    expect(payload).toHaveProperty('settings');
  });

  it('triggers a JSON download with the expected filename + MIME type', async () => {
    // Capture the JSON via a Blob.text() override. Wrap the global Blob so we
    // can intercept the constructor without breaking other consumers.
    const originalBlob = global.Blob;
    let blobText = '';
    global.Blob = class extends originalBlob {
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        blobText = parts
          .map((p) => (typeof p === 'string' ? p : ''))
          .join('');
      }
    } as unknown as typeof Blob;

    try {
      render(<DataExportPage />);

      const btn = await screen.findByRole('button', { name: /Download all data \(JSON\)/i });
      fireEvent.click(btn);

      await waitFor(() => {
        expect(capturedFilename).not.toBeNull();
      });

      expect(capturedFilename).toMatch(/^e4k-export-Sunny-Otter-\d{4}-\d{2}-\d{2}\.json$/);
      expect(capturedMime).toBe('application/json');

      // The JSON body parses and contains the expected schema markers.
      const parsed = JSON.parse(blobText) as Record<string, unknown>;
      expect(parsed.schema).toBe('e4k-export-v1');
      expect(parsed.child).toBeDefined();
      expect(Array.isArray(parsed.progress)).toBe(true);
      expect((parsed.progress as unknown[]).length).toBe(1);

      // Success message visible.
      expect(screen.getByText(/Download started/i)).toBeInTheDocument();
    } finally {
      global.Blob = originalBlob;
    }
  });
});

void capturedJson;
