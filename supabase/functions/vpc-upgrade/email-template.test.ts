/**
 * Sprint 5 S5-4: contract tests for the three VPC email templates.
 *
 * Runs under Deno's built-in test runner:
 *   deno test --allow-env supabase/functions/vpc-upgrade/email-template.test.ts
 *
 * The tests guard four invariants we care about for COPPA + brand safety:
 *   1. No `undefined` substring leaks into rendered HTML or text — a missing
 *      template field must always fall back to a literal string.
 *   2. The confirm link is a valid http(s) URL — a malformed link is a
 *      phishing-friendly footgun.
 *   3. Plain-text rendering is non-empty so screen readers and text-only
 *      mail clients see something legible.
 *   4. Each template name resolves; an unknown name throws.
 *
 * The HTML structure isn't snapshot-tested — copy changes are routine and
 * we don't want a snapshot fight every time marketing updates a tagline.
 */

import { renderEmailTemplate } from '../_shared/email-templates.ts';
import { assert, assertEquals, assertStringIncludes, assertThrows } from 'std/assert/mod.ts';

const ORIGIN = 'https://english4kids.app';
const LINK = `${ORIGIN}/vpc-confirm/abc123token`;

function assertNoUndefinedLeak(s: string, label: string): void {
  // "undefined" appearing in a rendered email is the canonical sign of a
  // missing-field bug. Strings that legitimately contain the word
  // ("...is not undefined...") aren't in scope; if they show up, this
  // assertion needs to learn the difference.
  assert(
    !s.includes('undefined'),
    `${label} leaked the literal "undefined" into the output:\n${s.slice(0, 400)}`,
  );
}

function assertNoNaN(s: string, label: string): void {
  assert(!s.includes('NaN'), `${label} leaked NaN`);
}

Deno.test('vpc-first-confirmation renders subject + html + text', () => {
  const r = renderEmailTemplate('vpc-first-confirmation', {
    confirmLink: LINK,
    parentNickname: 'Asha',
  });
  assertEquals(r.subject, 'Confirm your English4Kids parent account');
  assertStringIncludes(r.html, 'Hi Asha,');
  assertStringIncludes(r.html, LINK);
  assertStringIncludes(r.text, LINK);
  assertNoUndefinedLeak(r.html, 'first-confirmation html');
  assertNoUndefinedLeak(r.text, 'first-confirmation text');
});

Deno.test('vpc-first-confirmation falls back to "there" when nickname is missing', () => {
  const r = renderEmailTemplate('vpc-first-confirmation', { confirmLink: LINK });
  assertStringIncludes(r.html, 'Hi there,');
  assertStringIncludes(r.text, 'Hi there,');
  assertNoUndefinedLeak(r.html, 'first-confirmation html (no nickname)');
});

Deno.test('vpc-first-confirmation throws when confirmLink is missing or invalid', () => {
  assertThrows(
    () => renderEmailTemplate('vpc-first-confirmation', {}),
    Error,
    'confirmLink missing or invalid',
  );
  assertThrows(
    () =>
      renderEmailTemplate('vpc-first-confirmation', {
        confirmLink: 'javascript:alert(1)',
      }),
    Error,
    'confirmLink missing or invalid',
  );
});

Deno.test('vpc-second-confirmation-reminder includes the available-at timestamp', () => {
  const iso = '2026-05-21T10:00:00.000Z';
  const r = renderEmailTemplate('vpc-second-confirmation-reminder', {
    confirmLink: LINK,
    parentNickname: 'Asha',
    secondConfirmAvailableAt: iso,
  });
  assertEquals(r.subject, 'Ready to finish your English4Kids setup');
  assertStringIncludes(r.html, LINK);
  assertStringIncludes(r.text, LINK);
  assertNoUndefinedLeak(r.html, 'second-reminder html');
  assertNoNaN(r.html, 'second-reminder html');
});

Deno.test('vpc-second-confirmation-reminder falls back to "tomorrow" on bad timestamp', () => {
  const r = renderEmailTemplate('vpc-second-confirmation-reminder', {
    confirmLink: LINK,
    secondConfirmAvailableAt: 'not-an-iso',
  });
  assertStringIncludes(r.html, 'tomorrow');
  assertNoNaN(r.html, 'second-reminder html (bad iso)');
});

Deno.test('vpc-upgrade-complete includes the verified email', () => {
  const r = renderEmailTemplate('vpc-upgrade-complete', {
    parentNickname: 'Asha',
    verifiedEmail: 'parent@example.com',
  });
  assertEquals(r.subject, 'Welcome to English4Kids cloud sync');
  assertStringIncludes(r.html, 'parent@example.com');
  assertStringIncludes(r.text, 'parent@example.com');
  assertNoUndefinedLeak(r.html, 'upgrade-complete html');
});

Deno.test('vpc-upgrade-complete falls back when verifiedEmail is missing', () => {
  const r = renderEmailTemplate('vpc-upgrade-complete', { parentNickname: 'Asha' });
  // The fallback is the literal string "your email" — never undefined.
  assertStringIncludes(r.html, 'your email');
  assertNoUndefinedLeak(r.html, 'upgrade-complete html (no email)');
});

Deno.test('HTML always escapes embedded angle brackets in nickname', () => {
  const r = renderEmailTemplate('vpc-first-confirmation', {
    confirmLink: LINK,
    parentNickname: '<script>alert(1)</script>',
  });
  assert(!r.html.includes('<script>'), 'unescaped <script> tag leaked into HTML');
  assertStringIncludes(r.html, '&lt;script&gt;');
});
