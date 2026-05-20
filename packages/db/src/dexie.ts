/**
 * Local-first Dexie schema mirroring the Supabase tables.
 *
 * Why local-first: kids on patchy WiFi (or offline) keep progressing; the
 * sync outbox flushes to Supabase opportunistically. The single source of
 * truth at runtime is Dexie; Supabase is the durable backup + cross-device.
 */

import Dexie, { type Table } from 'dexie';
import type {
  AuditEvent,
  Child,
  Profile,
  Progress,
  PronunciationAttempt,
  SyncOutboxRow,
  VocabState,
} from './types';

export interface LocalSettings {
  key: string;
  value: unknown;
}

export class E4KDatabase extends Dexie {
  profiles!: Table<Profile, string>;
  children!: Table<Child, string>;
  progress!: Table<Progress, string>;
  vocabState!: Table<VocabState, string>;
  pronunciationAttempts!: Table<PronunciationAttempt, string>;
  auditLog!: Table<AuditEvent, number>;
  syncOutbox!: Table<SyncOutboxRow, string>;
  settings!: Table<LocalSettings, string>;

  constructor() {
    super('english4kids');
    this.version(1).stores({
      profiles: 'id, role',
      children: 'id, parent_id, age_band',
      progress: 'id, child_id, lesson_id, [child_id+lesson_id]',
      vocabState: 'id, child_id, word_key, [child_id+word_key], due_at',
      pronunciationAttempts: 'id, child_id, word_key, attempted_at',
      auditLog: '++id, child_id, occurred_at',
      syncOutbox: 'id, child_id, client_op_id, applied_at',
      settings: 'key',
    });
  }
}

/** Singleton Dexie instance for the browser app. */
export const db = new E4KDatabase();
