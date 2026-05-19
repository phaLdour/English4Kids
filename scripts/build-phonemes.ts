#!/usr/bin/env node
/**
 * build-phonemes
 *
 * Reads all `content/vocab/unit-*.json` files, looks up each word in the
 * vendored mini CMU dictionary (`scripts/cmu-dict-mini.json`), and writes
 * per-unit phoneme maps to `apps/web/public/phonemes/<unit>.json` for the
 * runtime pronunciation scorer.
 *
 * Pure Node TS — no external dependencies. Run with:
 *   node --import tsx scripts/build-phonemes.ts
 * or via the `apps/web` `prebuild` script.
 *
 * Critic S0: phonemes are precomputed at build time so the client never has
 * to run grapheme-to-phoneme inference. The dictionary itself ships under
 * BSD-2 (see PROVENANCE.md).
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const VOCAB_DIR = join(ROOT, 'content', 'vocab');
const OUT_DIR = join(ROOT, 'apps', 'web', 'public', 'phonemes');
const DICT_PATH = join(__dirname, 'cmu-dict-mini.json');

type Dict = Record<string, string[] | { _meta?: unknown }>;
type VocabEntry = {
  id: string;
  word: string;
  phonemes?: string[];
};

function loadDict(): Map<string, string[]> {
  const raw = JSON.parse(readFileSync(DICT_PATH, 'utf8')) as Dict;
  const map = new Map<string, string[]>();
  for (const [k, v] of Object.entries(raw)) {
    if (k === '_meta') continue;
    if (Array.isArray(v)) {
      map.set(k.toLowerCase(), v as string[]);
    }
  }
  return map;
}

function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

function unitIdFromFile(filename: string): string {
  // unit-01.json -> 01
  const m = filename.match(/^unit-(\d+)\.json$/);
  return m ? m[1] : filename.replace(/\.json$/, '');
}

function main() {
  const dict = loadDict();
  console.log(`[build-phonemes] loaded ${dict.size} dictionary entries`);

  mkdirSync(OUT_DIR, { recursive: true });

  let totalEntries = 0;
  let totalMissing = 0;
  const missingByUnit: Record<string, string[]> = {};

  for (const filename of readdirSync(VOCAB_DIR)) {
    if (!filename.endsWith('.json')) continue;
    const unitId = unitIdFromFile(filename);
    const filePath = join(VOCAB_DIR, filename);
    const entries = JSON.parse(readFileSync(filePath, 'utf8')) as VocabEntry[];

    const output: Record<string, string[]> = {};
    const missing: string[] = [];

    for (const entry of entries) {
      const key = normalizeWord(entry.word);
      const fromDict = dict.get(key);
      if (fromDict) {
        output[entry.id] = fromDict;
      } else if (entry.phonemes && entry.phonemes.length > 0) {
        // Fall back to authored phonemes (e.g. multi-word chunks not in dict).
        output[entry.id] = entry.phonemes;
      } else {
        missing.push(entry.word);
      }
      totalEntries += 1;
    }

    const outPath = join(OUT_DIR, `unit-${unitId}.json`);
    writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
    console.log(
      `[build-phonemes] wrote ${outPath} (${Object.keys(output).length} entries, ${missing.length} missing)`,
    );

    if (missing.length > 0) {
      missingByUnit[unitId] = missing;
      totalMissing += missing.length;
    }
  }

  if (totalMissing > 0) {
    console.warn('[build-phonemes] WARNING — missing dictionary entries:');
    for (const [unit, words] of Object.entries(missingByUnit)) {
      console.warn(`  unit-${unit}: ${words.join(', ')}`);
    }
    console.warn(
      `[build-phonemes] ${totalMissing} word(s) had no dict entry; ` +
        'add them to scripts/cmu-dict-mini.json or author phonemes in vocab JSON.',
    );
  }

  console.log(
    `[build-phonemes] done — ${totalEntries} entries processed, ${totalMissing} missing.`,
  );

  // Non-zero exit on missing so CI can fail loudly.
  if (totalMissing > 0) process.exit(1);
}

main();
