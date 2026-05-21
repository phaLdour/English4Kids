#!/usr/bin/env node
/**
 * check-mascot-parity
 *
 * Sprint 4 — S4-9 (Luna voice coverage parity, Critic Wave-2 S1-1).
 *
 * Walks every `content/audio-assets/unit-*.json` file and confirms that each
 * Milo activity prompt (`vo.milo.u<N>.l<L>.*`) has a corresponding Luna
 * counterpart (`vo.luna.u<N>.l<L>.*`). Story-narration assets (`vo.milo.story.*`
 * / `vo.luna.story.*`) are intentionally NOT included in the parity check:
 * stories are assigned to a single narrator by design (Unit 1+2 → Milo,
 * "The Quietest Animal" in Unit 3 → Luna). Activity prompts are the surface
 * where the user picks a mascot and expects to hear that mascot's voice.
 *
 * Coverage rule: for each unit, `coverage = lunaActivityCount / miloActivityCount`
 * must be >= MIN_COVERAGE (default 0.9). Failing units cause a non-zero
 * exit; the unmatched Milo keys are printed so authors can fix them in one
 * pass.
 *
 * Run:
 *   node --import tsx scripts/check-mascot-parity.ts
 *   pnpm check:mascot-parity   # via Turborepo at the repo root
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const AUDIO_ASSETS_DIR = join(ROOT, 'content', 'audio-assets');

const MIN_COVERAGE = 0.9;

interface AssetEntry {
  src: string;
  voiceActor?: string;
  lang: string;
  durationSec: number;
  transcript: string;
  type: string;
  license: string;
}
type AssetMap = Record<string, AssetEntry>;

interface UnitReport {
  unit: string;
  miloActivityKeys: string[];
  lunaActivityKeys: string[];
  missingLunaForMilo: string[];
  coverage: number;
}

/** Match keys like `vo.milo.u1.l3.sayRed` — activity-prompt narration only. */
function isActivityKey(key: string, mascot: 'milo' | 'luna'): boolean {
  const re = new RegExp(`^vo\\.${mascot}\\.u\\d+\\.l\\d+\\.`);
  return re.test(key);
}

function analyseUnit(file: string): UnitReport {
  const raw = readFileSync(join(AUDIO_ASSETS_DIR, file), 'utf8');
  const map = JSON.parse(raw) as AssetMap;

  const milo: string[] = [];
  const luna: string[] = [];
  for (const [key, entry] of Object.entries(map)) {
    if (entry.type !== 'narration') continue;
    if (isActivityKey(key, 'milo')) milo.push(key);
    else if (isActivityKey(key, 'luna')) luna.push(key);
  }

  const lunaSet = new Set(luna.map((k) => k.replace(/^vo\.luna\./, '')));
  const missing = milo
    .map((k) => k.replace(/^vo\.milo\./, ''))
    .filter((suffix) => !lunaSet.has(suffix))
    .map((suffix) => `vo.milo.${suffix}`);

  const coverage = milo.length === 0 ? 1 : luna.length / milo.length;
  return {
    unit: file,
    miloActivityKeys: milo,
    lunaActivityKeys: luna,
    missingLunaForMilo: missing,
    coverage,
  };
}

function main(): void {
  const files = readdirSync(AUDIO_ASSETS_DIR)
    .filter((f) => f.startsWith('unit-') && f.endsWith('.json'))
    .sort();

  if (files.length === 0) {
    console.error(`[check-mascot-parity] No audio-asset files found in ${AUDIO_ASSETS_DIR}.`);
    process.exit(1);
  }

  let allPass = true;
  for (const file of files) {
    const r = analyseUnit(file);
    const pct = (r.coverage * 100).toFixed(1);
    const status = r.coverage >= MIN_COVERAGE ? 'PASS' : 'FAIL';
    console.log(
      `[${status}] ${r.unit}: milo=${r.miloActivityKeys.length} luna=${r.lunaActivityKeys.length} coverage=${pct}% (min ${(MIN_COVERAGE * 100).toFixed(0)}%)`,
    );
    if (r.coverage < MIN_COVERAGE) {
      allPass = false;
      console.error(`  missing Luna for ${r.missingLunaForMilo.length} Milo key(s):`);
      for (const k of r.missingLunaForMilo) console.error(`    - ${k}`);
    }
  }

  if (!allPass) {
    console.error('\n[check-mascot-parity] FAILED — see missing keys above.');
    process.exit(1);
  }
  console.log('\n[check-mascot-parity] OK — all units meet the parity threshold.');
}

main();
