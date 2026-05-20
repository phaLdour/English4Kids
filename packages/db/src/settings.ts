/**
 * Local user-preferences store backed by Dexie's `settings` table.
 *
 * Keys are namespaced strings; values are arbitrary JSON-serializable data.
 * Each helper is async because Dexie returns Promises.
 */

import { db } from './dexie';

/** Recognized setting keys (string literal union for autocomplete; not enforced at runtime). */
export type SettingKey =
  | 'audio.master'
  | 'audio.music'
  | 'audio.sfx'
  | 'audio.voice'
  | 'audio.muted'
  | 'audio.focusMode'
  | 'mascot.choice'
  | 'narration.speed'
  | 'captions.enabled'
  | 'font.dyslexia'
  | 'motion.reduced'
  | 'contrast.high'
  | 'mic.enabled'
  | 'mic.engine'
  | 'pronunciation.strictness'
  | (string & {}); // allow free-form keys without losing autocomplete on the literals

export type MicEngine = 'web-speech' | 'whisper-offline';

/**
 * Read a setting, falling back to `fallback` if the key is missing or storage
 * is unavailable (e.g. private browsing with IDB blocked).
 */
export async function getSetting<T>(key: SettingKey, fallback: T): Promise<T> {
  try {
    const row = await db.settings.get(key);
    if (row === undefined) return fallback;
    return row.value as T;
  } catch {
    return fallback;
  }
}

/**
 * Write a setting. Last-write-wins; no merging.
 */
export async function setSetting(key: SettingKey, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

/** Bulk-read settings for boot-time hydration. */
export async function getAllSettings(): Promise<Record<string, unknown>> {
  const rows = await db.settings.toArray();
  const out: Record<string, unknown> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}
