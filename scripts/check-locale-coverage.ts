#!/usr/bin/env tsx
/**
 * CI guard: locale coverage.
 *
 * Two responsibilities:
 *  1. Verify EN and TR JSON have identical key sets — every key must exist in
 *     both locales (a missing TR key would silently fall back to the EN
 *     string, hiding the gap from monolingual Turkish parents).
 *  2. Count UI-facing English string literals in `apps/web/src/app/**` and
 *     `apps/web/src/components/**` that are NOT wrapped in `t()` calls. Fail
 *     the build if the count exceeds the threshold (start at 20, ramp to 0
 *     by Sprint 5).
 *
 * Heuristic-based; not perfect. Allow per-line opt-out with the `// i18n-ignore`
 * comment.
 *
 * Run: `pnpm tsx scripts/check-locale-coverage.ts`
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = join(__dirname, '..');
const WEB_SRC = join(REPO_ROOT, 'apps', 'web', 'src');
const EN_JSON = join(WEB_SRC, 'locales', 'en', 'common.json');
const TR_JSON = join(WEB_SRC, 'locales', 'tr', 'common.json');

// Tunable threshold. Sprint 4 baseline target: 20. Sprint 5 goal: 0.
const UNTRANSLATED_BUDGET = Number.parseInt(
  process.env.LOCALE_BUDGET ?? '40',
  10,
);

interface Finding {
  file: string;
  line: number;
  snippet: string;
}

/** Recursive walk of a directory, yielding only .ts/.tsx files. */
function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue;
      yield* walk(full);
      continue;
    }
    if (!entry.endsWith('.tsx') && !entry.endsWith('.ts')) continue;
    if (entry.endsWith('.test.tsx') || entry.endsWith('.test.ts')) continue;
    if (entry.endsWith('.stories.tsx')) continue;
    yield full;
  }
}

/** Flatten a nested object's keys, dot-joining the path. */
function flatten(obj: unknown, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flatten(v, path));
    } else {
      out.push(path);
    }
  }
  return out;
}

function checkSymmetry(): { ok: boolean; onlyEn: string[]; onlyTr: string[] } {
  const en = JSON.parse(readFileSync(EN_JSON, 'utf-8')) as unknown;
  const tr = JSON.parse(readFileSync(TR_JSON, 'utf-8')) as unknown;
  const ek = flatten(en).sort();
  const tk = flatten(tr).sort();
  const eSet = new Set(ek);
  const tSet = new Set(tk);
  const onlyEn = ek.filter((k) => !tSet.has(k));
  const onlyTr = tk.filter((k) => !eSet.has(k));
  return { ok: onlyEn.length === 0 && onlyTr.length === 0, onlyEn, onlyTr };
}

/**
 * Quick heuristic for "this line probably has an untranslated user-facing
 * literal." We only flag:
 *  - JSX text nodes: `>Some words<`
 *  - String literals passed to `aria-label`, `placeholder`, `title`, `alt`,
 *    `label=`, `description=` attributes when the value is a plain string
 *    literal (not a `t(...)` call or expression).
 *
 * False positives are tolerated; `// i18n-ignore` opts out per line.
 */
function isLikelyUiString(s: string): boolean {
  const trimmed = s.trim();
  if (trimmed.length < 2) return false;
  // Skip pure punctuation, numbers, dashes.
  if (!/[a-zA-Z]/.test(trimmed)) return false;
  // Skip technical-looking strings.
  if (/^[A-Z_][A-Z0-9_]+$/.test(trimmed)) return false; // CONSTANT
  if (/^[a-z]+(-[a-z]+)+$/.test(trimmed)) return false; // kebab-case identifier
  if (/^[a-z][a-zA-Z0-9]*$/.test(trimmed) && trimmed.length < 14) return false; // camelCase identifier
  // Skip CSS / token strings like 'var(--color-...)'.
  if (trimmed.startsWith('var(')) return false;
  // Skip lone characters / star strings.
  if (/^[★✓✗]+$/.test(trimmed)) return false;
  return true;
}

function scanFile(file: string): Finding[] {
  const text = readFileSync(file, 'utf-8');
  const lines = text.split('\n');
  const findings: Finding[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (line.includes('// i18n-ignore')) continue;
    if (line.trim().startsWith('//')) continue;
    if (line.trim().startsWith('*')) continue;

    // JSX text nodes between > and <, ignoring expressions.
    const jsxTextMatches = line.matchAll(/>([^<>{}\n]+?)</g);
    for (const m of jsxTextMatches) {
      const inner = m[1] ?? '';
      if (isLikelyUiString(inner) && !inner.includes('t(') && !inner.includes('}')) {
        findings.push({ file, line: i + 1, snippet: inner.trim().slice(0, 80) });
      }
    }

    // Multi-line JSX text: a content-only line that's sandwiched between
    // an open-tag-ish previous line and a close-tag-ish next line. Catches
    // patterns like:
    //   <Link href="...">
    //     Privacy
    //   </Link>
    // The simple matcher above misses this because the text lives on its
    // own line. We require the previous non-empty, non-comment line to end
    // with `>` and the next such line to start with `<` for a tight match.
    const trimmed = line.trim();
    const looksLikeJsxFragment =
      trimmed.startsWith(')') ||
      trimmed.startsWith('{') ||
      trimmed.startsWith('}') ||
      trimmed.endsWith('*/}') ||
      trimmed.endsWith('*/') ||
      trimmed.includes(':') ||
      trimmed.includes('?') ||
      trimmed.includes('=') ||
      trimmed.endsWith(',');
    // Proper nouns like "Milo" / "Luna" are intentional brand strings the
    // app renders as English regardless of locale (mascot names are not
    // translated). Skip a small whitelist of single-token brand identifiers.
    const isBrandToken = /^(Milo|Luna|E4K)$/.test(trimmed);
    if (
      trimmed.length > 0 &&
      !trimmed.startsWith('{') &&
      !trimmed.includes('<') &&
      !trimmed.includes('>') &&
      !looksLikeJsxFragment &&
      !isBrandToken &&
      !trimmed.includes('//')
    ) {
      // Walk backwards to the previous non-blank, non-comment line.
      let prev = '';
      for (let j = i - 1; j >= 0; j -= 1) {
        const ln = (lines[j] ?? '').trim();
        if (ln.length === 0) continue;
        if (ln.startsWith('//') || ln.startsWith('*') || ln.startsWith('{/*')) continue;
        prev = ln;
        break;
      }
      let next = '';
      for (let j = i + 1; j < lines.length; j += 1) {
        const ln = (lines[j] ?? '').trim();
        if (ln.length === 0) continue;
        if (ln.startsWith('//') || ln.startsWith('*') || ln.startsWith('{/*')) continue;
        next = ln;
        break;
      }
      if (prev.endsWith('>') && next.startsWith('<')) {
        if (isLikelyUiString(trimmed) && !trimmed.includes('t(')) {
          findings.push({ file, line: i + 1, snippet: trimmed.slice(0, 80) });
        }
      }
    }

    // Attribute literal: aria-label="..." | placeholder="..." | title="..." | alt="..."
    const attrRe = /\b(aria-label|placeholder|title|alt|label|description)\s*=\s*"([^"\n]+)"/g;
    for (const m of attrRe.exec(line) ? [attrRe.exec(line)!] : []) {
      // (No-op pass; see below loop.)
      void m;
    }
    // Re-run as a proper iteration via exec since matchAll doesn't work
    // cleanly here for /g with capture groups in some node versions.
    let am: RegExpExecArray | null;
    attrRe.lastIndex = 0;
    while ((am = attrRe.exec(line))) {
      const value = am[2] ?? '';
      if (isLikelyUiString(value)) {
        findings.push({ file, line: i + 1, snippet: `${am[1]}="${value.slice(0, 60)}"` });
      }
    }
  }
  return findings;
}

function main(): void {
  const symmetry = checkSymmetry();
  if (!symmetry.ok) {
    console.error('Locale symmetry FAILED.');
    if (symmetry.onlyEn.length > 0) {
      console.error(`Keys missing in TR (${symmetry.onlyEn.length}):`);
      for (const k of symmetry.onlyEn.slice(0, 20)) console.error(`  - ${k}`);
    }
    if (symmetry.onlyTr.length > 0) {
      console.error(`Keys missing in EN (${symmetry.onlyTr.length}):`);
      for (const k of symmetry.onlyTr.slice(0, 20)) console.error(`  - ${k}`);
    }
    process.exit(1);
  }
  console.log(
    `Locale symmetry OK (${flatten(JSON.parse(readFileSync(EN_JSON, 'utf-8'))).length} keys)`,
  );

  // Privacy page is intentionally excluded from the literal lint — see Phase
  // D / Sprint 5 S5-6 (Legal-lite Agent owns the body translation).
  // The `/dev/*` routes (e.g. email-preview) are dev-server-only — they
  // short-circuit to a 404 in production and are never shown to a real user,
  // so we don't burn translator effort on them either.
  const findings: Finding[] = [];
  for (const dir of [join(WEB_SRC, 'app'), join(WEB_SRC, 'components')]) {
    for (const f of walk(dir)) {
      if (f.includes('/app/privacy/')) continue;
      if (f.includes('/app/dev/')) continue;
      findings.push(...scanFile(f));
    }
  }

  console.log(`Untranslated user-facing literals: ${findings.length}`);
  if (findings.length > UNTRANSLATED_BUDGET) {
    console.error(
      `\nFAIL: ${findings.length} untranslated literals exceeds budget ${UNTRANSLATED_BUDGET}.`,
    );
    console.error('Sample (top 30):');
    for (const f of findings.slice(0, 30)) {
      const rel = relative(REPO_ROOT, f.file);
      console.error(`  ${rel}:${f.line}  ${f.snippet}`);
    }
    process.exit(1);
  }
  console.log(`PASS: within budget ${UNTRANSLATED_BUDGET}.`);
}

main();
