#!/usr/bin/env tsx
/**
 * Pre-flight check for production secrets — Sprint 5 S5-8.
 *
 * Reads `.env.example` at the repo root, enumerates every variable
 * declared there plus the production-only build secrets that aren't
 * checked into `.env.example` (Sentry source-map upload), and reports
 * which are set in the current shell.
 *
 * In `local` mode (default) the script reports status and exits 0 even
 * if some are missing — the kid-only dev loop doesn't need Sentry,
 * Plausible, etc. In `production` mode (`E4K_VERIFY_MODE=production`)
 * the script exits non-zero if any *required* production secret is
 * absent. This is intended to be run by the devops operator as the
 * final pre-flight check before flipping DNS to the new deployment.
 *
 * Usage:
 *   pnpm tsx scripts/verify-secrets-ready.ts
 *   E4K_VERIFY_MODE=production pnpm tsx scripts/verify-secrets-ready.ts
 *
 * Exit codes:
 *   0  All required secrets present (or local mode and only warnings).
 *   1  Production mode and at least one required secret missing.
 *   2  Script failed to read .env.example.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const ENV_EXAMPLE = resolve(REPO_ROOT, '.env.example');

type VerifyMode = 'local' | 'production';

interface SecretSpec {
  name: string;
  required: 'always' | 'production' | 'optional';
  description: string;
}

/**
 * Production-only secrets that don't appear in `.env.example` because
 * they are build-time concerns (Vercel build env, GitHub Actions secrets)
 * rather than dev runtime concerns. Kept here so the launch checklist
 * remains a single command.
 */
const PRODUCTION_ONLY_SECRETS: readonly SecretSpec[] = [
  {
    name: 'SENTRY_ORG',
    required: 'production',
    description: 'Sentry organisation slug. Build-time only (next.config.ts).',
  },
  {
    name: 'SENTRY_PROJECT',
    required: 'production',
    description: 'Sentry project slug. Build-time only.',
  },
  {
    name: 'SENTRY_AUTH_TOKEN',
    required: 'production',
    description:
      'Sentry org auth token for source-map upload. Build-time only; never shipped to client.',
  },
  {
    name: 'NEXT_PUBLIC_SENTRY_DSN',
    required: 'production',
    description: 'Sentry DSN. Public-safe; rendered on the client.',
  },
];

function parseEnvExample(contents: string): SecretSpec[] {
  // Lines look like `KEY=value` or `KEY=`. Comments above a key
  // become its description (joined). We treat empty-default keys as
  // "required at runtime" and pre-filled defaults as optional.
  const lines = contents.split(/\r?\n/);
  const specs: SecretSpec[] = [];
  let pendingDescription: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') {
      pendingDescription = [];
      continue;
    }
    if (line.startsWith('#')) {
      pendingDescription.push(line.replace(/^#\s?/, ''));
      continue;
    }
    const eq = line.indexOf('=');
    if (eq < 0) {
      pendingDescription = [];
      continue;
    }
    const name = line.slice(0, eq).trim();
    const defaultValue = line.slice(eq + 1).trim();
    specs.push({
      name,
      required: defaultValue === '' ? 'always' : 'optional',
      description: pendingDescription.join(' ').trim(),
    });
    pendingDescription = [];
  }
  return specs;
}

function isProductionRequired(spec: SecretSpec): boolean {
  return spec.required === 'always' || spec.required === 'production';
}

function statusGlyph(set: boolean): string {
  return set ? '  set' : 'MISSING';
}

function main(): number {
  const mode: VerifyMode =
    process.env.E4K_VERIFY_MODE === 'production' ? 'production' : 'local';

  let envExampleRaw: string;
  try {
    envExampleRaw = readFileSync(ENV_EXAMPLE, 'utf8');
  } catch (err) {
    console.error(`[verify-secrets] cannot read ${ENV_EXAMPLE}:`, err);
    return 2;
  }

  const fromExample = parseEnvExample(envExampleRaw);
  // Merge the production-only list, preferring the more specific
  // `required` flag if a name appears in both.
  const byName = new Map<string, SecretSpec>();
  for (const spec of fromExample) byName.set(spec.name, spec);
  for (const spec of PRODUCTION_ONLY_SECRETS) {
    const existing = byName.get(spec.name);
    if (!existing) byName.set(spec.name, spec);
    else byName.set(spec.name, { ...existing, required: spec.required });
  }
  const allSpecs = Array.from(byName.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  console.log(`English4Kids — secrets pre-flight (mode: ${mode})`);
  console.log('-'.repeat(72));

  const missingRequired: string[] = [];
  const missingOptional: string[] = [];

  for (const spec of allSpecs) {
    const value = process.env[spec.name];
    const isSet = value !== undefined && value !== '';
    const required = isProductionRequired(spec);
    console.log(`  ${statusGlyph(isSet)}  ${spec.name}${required ? ' *' : ''}`);
    if (!isSet) {
      if (required) missingRequired.push(spec.name);
      else missingOptional.push(spec.name);
    }
  }

  console.log('-'.repeat(72));
  console.log(`Required-but-missing: ${missingRequired.length}`);
  console.log(`Optional-but-missing: ${missingOptional.length}`);
  console.log('(* = required in production)');
  console.log();
  console.log(
    'See docs/devops/secrets-management.md for set commands per environment.',
  );

  if (mode === 'production' && missingRequired.length > 0) {
    console.error(
      `\n[verify-secrets] FAIL — ${missingRequired.length} required secret(s) missing in production mode.`,
    );
    for (const name of missingRequired) console.error(`  - ${name}`);
    return 1;
  }

  return 0;
}

process.exit(main());
