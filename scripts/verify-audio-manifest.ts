#!/usr/bin/env node
/**
 * verify-audio-manifest
 *
 * Sprint 4 — S4-1 CI gate.
 *
 * Walks `apps/web/public/audio/manifest.json` and confirms that every
 * referenced `.opus` + `.mp3` exists on disk with a matching SHA-256.
 * Exits non-zero on any mismatch so CI fails loudly when a re-render is
 * forgotten, an LFS pointer is stale, or a transcript was hand-edited
 * without re-running `build-narration.ts`.
 *
 * Run with:
 *   node --import tsx scripts/verify-audio-manifest.ts
 *   pnpm verify:audio        # via apps/web/package.json + turbo.json
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const PUBLIC_ROOT = join(ROOT, 'apps', 'web', 'public');
const MANIFEST_PATH = join(PUBLIC_ROOT, 'audio', 'manifest.json');

interface ManifestEntry {
  id: string;
  srcOpus: string;
  srcMp3: string;
  opusBytes: number;
  mp3Bytes: number;
  opusSha256: string;
  mp3Sha256: string;
}
interface Manifest {
  schemaVersion: number;
  totals: { assets: number };
  entries: ManifestEntry[];
}

function sha256OfFile(absPath: string): string {
  const buf = readFileSync(absPath);
  return createHash('sha256').update(buf).digest('hex');
}

function main(): void {
  if (!existsSync(MANIFEST_PATH)) {
    console.error(`[verify:audio] manifest missing: ${MANIFEST_PATH}`);
    console.error('  Run: node --import tsx scripts/build-narration.ts');
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest;
  console.log(
    `[verify:audio] checking ${manifest.entries.length} entries (schema v${manifest.schemaVersion})`,
  );

  const errors: string[] = [];
  let checked = 0;
  for (const entry of manifest.entries) {
    for (const variant of ['opus', 'mp3'] as const) {
      const src = variant === 'opus' ? entry.srcOpus : entry.srcMp3;
      const expectedSha = variant === 'opus' ? entry.opusSha256 : entry.mp3Sha256;
      const expectedBytes = variant === 'opus' ? entry.opusBytes : entry.mp3Bytes;
      const fsPath = join(PUBLIC_ROOT, src.replace(/^\//, ''));
      if (!existsSync(fsPath)) {
        errors.push(`MISSING ${variant} for ${entry.id}: ${src}`);
        continue;
      }
      const buf = readFileSync(fsPath);
      if (buf.length !== expectedBytes) {
        errors.push(
          `SIZE  ${variant} for ${entry.id}: expected ${expectedBytes}B got ${buf.length}B`,
        );
        continue;
      }
      const actualSha = sha256OfFile(fsPath);
      if (actualSha !== expectedSha) {
        errors.push(
          `SHA   ${variant} for ${entry.id}: expected ${expectedSha.slice(0, 12)}… got ${actualSha.slice(0, 12)}…`,
        );
        continue;
      }
      checked += 1;
    }
  }

  if (errors.length > 0) {
    console.error(`[verify:audio] FAILED — ${errors.length} mismatch(es):`);
    for (const e of errors.slice(0, 20)) console.error(`  ${e}`);
    if (errors.length > 20) console.error(`  …and ${errors.length - 20} more`);
    console.error(
      '\n  Fix: re-run `node --import tsx scripts/build-narration.ts` and commit the result.',
    );
    process.exit(1);
  }

  console.log(`[verify:audio] OK — ${checked} files verified.`);
}

main();
