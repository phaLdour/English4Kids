#!/usr/bin/env node
/**
 * Validates all authored unit JSON in /content/units against the schema
 * and scans every visible prompt/transcript/narration/encouragement for
 * banned phrasings. Exits non-zero on the first failure (with all errors
 * reported), so Turborepo / CI can gate on it.
 *
 * Usage:
 *   pnpm --filter @e4k/content-schema validate:content
 *   pnpm validate:content   # via Turborepo at the repo root
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { containsBannedPhrasing } from '../src/banned-words';
import type { Unit } from '../src/schemas';
import { validateUnit } from '../src/validate';

// Locate the repo root: assume this file lives at <repo>/packages/content-schema/bin/.
const __filename = fileURLToPath(import.meta.url);
const HERE = resolve(__filename, '..');
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const UNITS_DIR = resolve(REPO_ROOT, 'content', 'units');

interface Issue {
  file: string;
  message: string;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function walkJson(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walkJson(full)));
    } else if (e.isFile() && e.name.endsWith('.json')) {
      out.push(full);
    }
  }
  return out;
}

/** Gather every text field that kids might hear or see. */
function collectTexts(unit: Unit): { path: string; text: string }[] {
  const texts: { path: string; text: string }[] = [];
  for (const lesson of unit.lessons) {
    if (lesson.tprBreak) {
      texts.push({
        path: `${unit.id}/${lesson.id}/tprBreak`,
        text: lesson.tprBreak.promptText,
      });
    }
    for (const activity of lesson.activities) {
      for (const item of activity.items) {
        const base = `${unit.id}/${lesson.id}/${activity.id}/${item.id}`;
        switch (item.type) {
          case 'listen_tap':
            texts.push({ path: `${base}.promptTranscript`, text: item.promptTranscript });
            if (item.distractorRationale)
              texts.push({ path: `${base}.distractorRationale`, text: item.distractorRationale });
            break;
          case 'word_builder':
            texts.push({ path: `${base}.promptTranscript`, text: item.promptTranscript });
            if (item.hintTranscript)
              texts.push({ path: `${base}.hintTranscript`, text: item.hintTranscript });
            break;
          case 'speak_it':
            texts.push({ path: `${base}.promptTranscript`, text: item.promptTranscript });
            for (let i = 0; i < item.encouragementSet.length; i++) {
              const e = item.encouragementSet[i];
              if (e !== undefined) {
                texts.push({ path: `${base}.encouragement[${i}]`, text: e });
              }
            }
            break;
          case 'story_time':
            for (const panel of item.panels) {
              texts.push({
                path: `${base}/panel/${panel.panelId}.narration`,
                text: panel.narrationText,
              });
            }
            for (const q of item.questions) {
              texts.push({ path: `${base}/q/${q.id}.promptTranscript`, text: q.promptTranscript });
              for (let i = 0; i < q.items.length; i++) {
                const it = q.items[i];
                if (it !== undefined) {
                  texts.push({ path: `${base}/q/${q.id}.items[${i}]`, text: it });
                }
              }
            }
            break;
          case 'sing_along':
            // sing_along refers to a song by id; lyrics live in audio asset map.
            break;
        }
      }
    }
  }
  return texts;
}

async function main(): Promise<void> {
  const issues: Issue[] = [];
  let unitsValidated = 0;

  if (!(await fileExists(UNITS_DIR))) {
    console.log(`[validate-content] No content/units directory at ${UNITS_DIR}. Skipping.`);
    process.exit(0);
  }

  const files = await walkJson(UNITS_DIR);
  if (files.length === 0) {
    console.log(`[validate-content] No unit JSON files found in ${UNITS_DIR}.`);
    process.exit(0);
  }

  for (const file of files) {
    const rel = relative(REPO_ROOT, file);
    let raw: string;
    try {
      raw = await readFile(file, 'utf8');
    } catch (e) {
      issues.push({ file: rel, message: `Failed to read: ${(e as Error).message}` });
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      issues.push({ file: rel, message: `Invalid JSON: ${(e as Error).message}` });
      continue;
    }

    let unit: Unit;
    try {
      unit = validateUnit(parsed);
    } catch (e) {
      issues.push({ file: rel, message: `Schema validation failed: ${(e as Error).message}` });
      continue;
    }

    unitsValidated += 1;

    for (const { path, text } of collectTexts(unit)) {
      const scan = containsBannedPhrasing(text);
      if (scan.found) {
        issues.push({
          file: rel,
          message: `Banned phrasing in ${path}: [${scan.matches.join(', ')}] — "${text}"`,
        });
      }
    }
  }

  if (issues.length > 0) {
    console.error(`[validate-content] ${issues.length} issue(s) found:`);
    for (const i of issues) {
      console.error(`  - ${i.file}: ${i.message}`);
    }
    process.exit(1);
  }

  console.log(`[validate-content] OK — ${unitsValidated} unit(s) validated, 0 issues.`);
  process.exit(0);
}

main().catch((e) => {
  console.error('[validate-content] Unexpected error:', e);
  process.exit(2);
});
