'use client';

/**
 * Data export.
 *
 * Bundles every Dexie table belonging to the active child into a single
 * JSON payload, then triggers a browser download via Blob +
 * URL.createObjectURL.
 *
 * SAFETY NOTE: this is the ONLY place in the app where a Blob may be
 * constructed. Audio Blobs remain banned (Safety Officer policy — kids' voice
 * data must never enter a Blob anywhere). If you find yourself wanting `new
 * Blob` outside this file, escalate to the Safety Officer first.
 */

import {
  db,
  getAllSettings,
  type AuditEvent,
  type Child,
  type Progress,
  type PronunciationAttempt,
  type VocabState,
} from '@e4k/db';
import { useCallback, useEffect, useState } from 'react';

interface ExportPayload {
  schema: 'e4k-export-v1';
  exportedAt: string;
  child: Child | null;
  progress: Progress[];
  vocab: VocabState[];
  pronunciation: PronunciationAttempt[];
  auditLog: AuditEvent[];
  settings: Record<string, unknown>;
}

function sanitiseFilenamePart(s: string): string {
  return s.replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'learner';
}

function todayIsoDay(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface BuildExportArgs {
  child: Child | null;
  progress: Progress[];
  vocab: VocabState[];
  pronunciation: PronunciationAttempt[];
  auditLog: AuditEvent[];
  settings: Record<string, unknown>;
  now?: Date;
}

/** Pure builder so tests can call it directly. */
export function buildExportPayload(args: BuildExportArgs): ExportPayload {
  return {
    schema: 'e4k-export-v1',
    exportedAt: (args.now ?? new Date()).toISOString(),
    child: args.child,
    progress: args.progress,
    vocab: args.vocab,
    pronunciation: args.pronunciation,
    auditLog: args.auditLog,
    settings: args.settings,
  };
}

export function buildExportFilename(nickname: string | null, now: Date = new Date()): string {
  const safe = sanitiseFilenamePart(nickname ?? 'learner');
  return `e4k-export-${safe}-${todayIsoDay(now)}.json`;
}

export default function DataExportPage() {
  const [child, setChild] = useState<Child | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await db.children.toArray();
        if (!cancelled && rows.length > 0 && rows[0]) setChild(rows[0]);
      } catch {
        // ignore — page still works with a null child.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDownload = useCallback(async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const activeChild = child;
      const childId = activeChild?.id;
      const [progress, vocab, pronunciation, auditLog, settings] = await Promise.all([
        childId ? db.progress.where('child_id').equals(childId).toArray() : Promise.resolve([]),
        childId ? db.vocabState.where('child_id').equals(childId).toArray() : Promise.resolve([]),
        childId
          ? db.pronunciationAttempts.where('child_id').equals(childId).toArray()
          : Promise.resolve([]),
        childId ? db.auditLog.where('child_id').equals(childId).toArray() : Promise.resolve([]),
        getAllSettings(),
      ]);

      const payload = buildExportPayload({
        child: activeChild,
        progress: progress as Progress[],
        vocab: vocab as VocabState[],
        pronunciation: pronunciation as PronunciationAttempt[],
        auditLog: auditLog as AuditEvent[],
        settings,
      });

      const json = JSON.stringify(payload, null, 2);
      // Data export Blob — JSON only. Audio Blobs remain banned (Safety Officer policy).
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = buildExportFilename(activeChild?.nickname ?? null);
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      // Defer revocation so the browser has a chance to start the download.
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the export.');
    } finally {
      setBusy(false);
    }
  }, [child]);

  return (
    <main
      data-testid="parent-export"
      className="mx-auto flex w-full max-w-2xl flex-col gap-[var(--space-6)] px-[var(--space-4)] py-[var(--space-6)] pb-[var(--space-16)]"
    >
      <section className="flex flex-col gap-[var(--space-4)] rounded-[var(--radius-lg)] bg-[var(--color-surface-high)] p-[var(--space-6)] shadow-[var(--shadow-card)]">
        <h1
          className="text-2xl text-[var(--color-primary-dark)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Download all data
        </h1>
        <p className="text-base text-[var(--color-ink)]">
          Your data is yours. This download includes every lesson, word, speaking attempt, and
          setting on this device, packaged as a single JSON file you can keep, share, or
          archive.
        </p>
        <p className="text-sm text-[var(--color-mist)]">
          The file lives on this device only. Nothing is uploaded.
        </p>
        <button
          type="button"
          onClick={() => void handleDownload()}
          disabled={busy}
          className="self-start rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-[var(--space-10)] py-[var(--space-4)] text-[var(--color-surface-high)] shadow-[var(--shadow-pop)] transition-transform duration-[var(--motion-fast)] active:scale-[0.98] disabled:opacity-60"
          style={{
            minHeight: 'var(--tap-primary-old)',
            fontFamily: 'var(--font-display)',
            fontSize: '1.125rem',
          }}
        >
          {busy ? 'Preparing...' : 'Download all data (JSON)'}
        </button>
        {done ? (
          <p
            role="status"
            aria-live="polite"
            className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-[var(--space-3)] text-[var(--color-ink)]"
          >
            Download started. Your data is yours.
          </p>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-[var(--space-3)] text-[var(--color-alert)]"
          >
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
