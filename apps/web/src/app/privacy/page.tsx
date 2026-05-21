import { PRIVACY_EFFECTIVE_DATE, PRIVACY_VERSION } from '@/lib/privacy-version';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PrivacyTranslationNotice } from './translation-notice';

export const metadata: Metadata = {
  title: 'Privacy Policy — English4Kids',
  description: 'How we keep children safe. Plain-language privacy policy.',
};

/**
 * Privacy-policy placeholders. Read from build-time env vars so the user can
 * fill them in by setting `NEXT_PUBLIC_E4K_LEGAL_ENTITY`,
 * `NEXT_PUBLIC_E4K_EU_REPRESENTATIVE`, and `NEXT_PUBLIC_E4K_SUPPORT_EMAIL` in
 * Vercel (or any deploy target). When unset, we fall back to a calm
 * "pending" copy so a real user never sees the literal `[PLACEHOLDER]`
 * bracketed sentinel even if a deploy slips through with the env unwired.
 * The three external blockers stay tracked in
 * `docs/launch/soft-launch-checklist.md` either way.
 */
const LEGAL_ENTITY =
  process.env.NEXT_PUBLIC_E4K_LEGAL_ENTITY ?? 'the operator of English4Kids (legal entity to be confirmed before public launch)';
const EU_REPRESENTATIVE =
  process.env.NEXT_PUBLIC_E4K_EU_REPRESENTATIVE ?? 'the operator (EU GDPR Article 27 representative to be confirmed before EU launch)';
const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_E4K_SUPPORT_EMAIL ?? 'the support address listed on the launch site';

/**
 * Privacy policy v1.0 — Sprint 5 S5-6.
 *
 * Covers everything that shipped through Sprint 5:
 *   - MVP local-first (Dexie / IndexedDB)
 *   - Phase 2 cloud sync via email-plus VPC (24h delay, three-layer
 *     anonymous-first gate)
 *   - Resend transactional email
 *   - Sentry error logging (DSN-gated, PII-scrubbed)
 *   - Plausible parent-only analytics (cookieless)
 *   - 7-day grace delete
 *   - COPPA / GDPR Art. 8 / UK AADC posture
 *
 * I18N: This page is LEGAL TEXT. The body stays in English under Sprint 5
 * policy (legal text needs native review before any TR translation goes
 * live). Section titles + the kid summary + change-log entries are i18n'd
 * via `privacy.*` keys so a Turkish reader sees titled scaffolding and the
 * top-of-page banner. The full TR translation is queued for the user's
 * native review.
 */
export default function PrivacyPage(): React.JSX.Element {
  return (
    <main className="mx-auto max-w-3xl bg-[var(--color-surface)] px-[var(--space-5)] py-[var(--space-8)] text-[var(--color-ink)]">
      <header className="mb-[var(--space-6)]">
        <h1
          className="text-3xl text-[var(--color-primary-dark)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Privacy Policy
        </h1>
        <p className="mt-[var(--space-2)] text-sm" data-testid="privacy-version-line">
          Version {PRIVACY_VERSION} &middot; Effective {PRIVACY_EFFECTIVE_DATE} &middot;{' '}
          <Link href="/privacy/parent-summary" className="underline">
            Parent quick summary
          </Link>
        </p>
        <PrivacyTranslationNotice />
      </header>

      {/* Kid summary — under 50 words, ~grade 3 readability. */}
      <section aria-labelledby="kid-summary" className="mb-[var(--space-6)]">
        <h2 id="kid-summary" className="text-2xl">
          A note for kids
        </h2>
        <p className="mt-[var(--space-2)] text-lg">
          English4Kids never sends your voice over the internet. Your nickname stays on your device.
          Your grown-up can see what you learned, but no one else.
        </p>
      </section>

      {/* 1. Data Controller */}
      <section aria-labelledby="controller" className="mb-[var(--space-6)]">
        <h2 id="controller" className="text-2xl">
          1. Data Controller
        </h2>
        <p className="mt-[var(--space-2)]">
          The data controller for the information processed through English4Kids is{' '}
          <strong>{LEGAL_ENTITY}</strong>. Our EU representative under GDPR Article 27 is{' '}
          <strong>{EU_REPRESENTATIVE}</strong>.
        </p>
        <p className="mt-[var(--space-2)]">
          For any privacy question, including data-subject requests, write to{' '}
          <strong>{SUPPORT_EMAIL}</strong>. We respond within 30 days as required by GDPR
          Article 12(3).
        </p>
      </section>

      {/* 2. Data inventory */}
      <section aria-labelledby="data" className="mb-[var(--space-6)]">
        <h2 id="data" className="text-2xl">
          2. What We Collect
        </h2>
        <p className="mt-[var(--space-2)]">
          The table below lists every category of data we touch. Anything not listed here is not
          collected.
        </p>
        <div className="mt-[var(--space-4)] overflow-x-auto">
          <table
            className="w-full border-collapse text-left text-sm"
            data-testid="privacy-data-inventory"
          >
            <thead>
              <tr className="border-b border-[var(--color-ink)]">
                <th className="py-[var(--space-2)] pr-[var(--space-3)]">Data</th>
                <th className="py-[var(--space-2)] pr-[var(--space-3)]">Where it lives</th>
                <th className="py-[var(--space-2)]">Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[var(--color-ink)] align-top">
                <td className="py-[var(--space-2)] pr-[var(--space-3)]">
                  Display name (an animal nickname, e.g. &ldquo;Sunny Otter&rdquo;)
                </td>
                <td className="py-[var(--space-2)] pr-[var(--space-3)]">
                  Local (Dexie). Optional cloud sync after VPC.
                </td>
                <td className="py-[var(--space-2)]">No real names asked.</td>
              </tr>
              <tr className="border-b border-[var(--color-ink)] align-top">
                <td className="py-[var(--space-2)] pr-[var(--space-3)]">
                  Age band (6&ndash;8 or 9&ndash;12)
                </td>
                <td className="py-[var(--space-2)] pr-[var(--space-3)]">
                  Local + cloud (post-VPC).
                </td>
                <td className="py-[var(--space-2)]">No exact birth date.</td>
              </tr>
              <tr className="border-b border-[var(--color-ink)] align-top">
                <td className="py-[var(--space-2)] pr-[var(--space-3)]">
                  Progress scores per lesson (0&ndash;100)
                </td>
                <td className="py-[var(--space-2)] pr-[var(--space-3)]">
                  Local + cloud (post-VPC).
                </td>
                <td className="py-[var(--space-2)]">For resuming and the parent dashboard.</td>
              </tr>
              <tr className="border-b border-[var(--color-ink)] align-top">
                <td className="py-[var(--space-2)] pr-[var(--space-3)]">
                  Pronunciation score (numeric 0&ndash;100, NEVER audio)
                </td>
                <td className="py-[var(--space-2)] pr-[var(--space-3)]">
                  Local + cloud (post-VPC).
                </td>
                <td className="py-[var(--space-2)]">Audio is processed on-device only.</td>
              </tr>
              <tr className="border-b border-[var(--color-ink)] align-top">
                <td className="py-[var(--space-2)] pr-[var(--space-3)]">
                  Audit events (lesson started/completed, settings changes)
                </td>
                <td className="py-[var(--space-2)] pr-[var(--space-3)]">
                  Local 90 days + cloud 90 days.
                </td>
                <td className="py-[var(--space-2)]">For the parent dashboard activity log.</td>
              </tr>
              <tr className="border-b border-[var(--color-ink)] align-top">
                <td className="py-[var(--space-2)] pr-[var(--space-3)]">Parent email</td>
                <td className="py-[var(--space-2)] pr-[var(--space-3)]">
                  Cloud only, ONLY if the parent completes the VPC upgrade. Resend stores delivery
                  metadata.
                </td>
                <td className="py-[var(--space-2)]">Transactional use only.</td>
              </tr>
              <tr className="border-b border-[var(--color-ink)] align-top">
                <td className="py-[var(--space-2)] pr-[var(--space-3)]">
                  Parent password hash (Argon2id)
                </td>
                <td className="py-[var(--space-2)] pr-[var(--space-3)]">
                  Cloud (managed by Supabase Auth).
                </td>
                <td className="py-[var(--space-2)]">Plain text never stored.</td>
              </tr>
              <tr className="border-b border-[var(--color-ink)] align-top">
                <td className="py-[var(--space-2)] pr-[var(--space-3)]">
                  User settings (volume, locale, mascot, font)
                </td>
                <td className="py-[var(--space-2)] pr-[var(--space-3)]">
                  Local + cloud (post-VPC).
                </td>
                <td className="py-[var(--space-2)]">Preferences only.</td>
              </tr>
              <tr className="border-b border-[var(--color-ink)] align-top">
                <td className="py-[var(--space-2)] pr-[var(--space-3)]">IP address</td>
                <td className="py-[var(--space-2)] pr-[var(--space-3)]">
                  Plausible (parent dashboard only, hashed and discarded daily); Supabase auth logs
                  30 days.
                </td>
                <td className="py-[var(--space-2)]">Never linked to a child profile.</td>
              </tr>
              <tr className="align-top">
                <td className="py-[var(--space-2)] pr-[var(--space-3)]">Raw microphone audio</td>
                <td className="py-[var(--space-2)] pr-[var(--space-3)]">
                  <strong>NEVER STORED, NEVER TRANSMITTED.</strong>
                </td>
                <td className="py-[var(--space-2)]">
                  Processed on-device by Web Speech or whisper.wasm.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-[var(--space-3)]">
          We do <strong>not</strong> collect: phone numbers, real names, exact ages, precise
          location, contact lists, photos, video, audio recordings, or persistent advertising
          identifiers. We do not place third-party trackers on any page a child can see.
        </p>
      </section>

      {/* 3. Microphone policy */}
      <section aria-labelledby="mic" className="mb-[var(--space-6)]">
        <h2 id="mic" className="text-2xl">
          3. Microphone Policy
        </h2>
        <ul className="mt-[var(--space-2)] list-disc pl-[var(--space-6)]">
          <li>
            <strong>Parent gate before first enable.</strong> The microphone is off until a grown-up
            passes the math challenge and turns it on.
          </li>
          <li>
            <strong>Persistent red-dot indicator.</strong> A visible red dot in the top bar appears
            whenever the microphone is active. Your child can tap it to stop at any time.
          </li>
          <li>
            <strong>On-device STT only.</strong> Speech-to-text runs in the browser (Web Speech API)
            or via an offline WASM model (whisper.cpp). The audio waveform never leaves the device.
          </li>
          <li>
            <strong>Only a numeric score crosses the network</strong>, and only after the parent
            completes the VPC email-plus upgrade.
          </li>
          <li>
            <strong>Auto-disable after 30 minutes</strong> of continuous use.
          </li>
          <li>
            <strong>Parent kill-switch</strong> in the Parent Dashboard disables the microphone
            globally without losing other progress.
          </li>
        </ul>
        <p className="mt-[var(--space-2)]">
          See the full{' '}
          <Link href="/privacy/parent-summary" className="underline">
            parent quick summary
          </Link>{' '}
          for a one-page version.
        </p>
      </section>

      {/* 4. Cloud sync & VPC */}
      <section aria-labelledby="cloud-sync" className="mb-[var(--space-6)]">
        <h2 id="cloud-sync" className="text-2xl">
          4. Cloud Sync &amp; Email Verification
        </h2>
        <p className="mt-[var(--space-2)]">
          Every account is <strong>anonymous-first</strong>. Local progress is stored on the device
          only until the parent explicitly upgrades the account by verifying an email address.
        </p>
        <p className="mt-[var(--space-2)]">
          The upgrade uses <strong>email-plus VPC</strong> (verifiable parental consent): we send a
          first confirmation email, then require a second confirmation no sooner than 24 hours
          later. The 24-hour delay is enforced on the server, not in the browser, so it cannot be
          shortened by reloading.
        </p>
        <p className="mt-[var(--space-2)]">
          Cloud sync activates only after the second confirmation succeeds. We enforce a{' '}
          <strong>three-layer anonymous-first gate</strong>: (a) the client refuses to enqueue rows
          when the profile is anonymous, (b) a Postgres trigger rejects writes from anonymous
          profiles, and (c) the sync edge function returns 403 if either of the previous checks is
          bypassed.
        </p>
        <p className="mt-[var(--space-2)]">
          <strong>Data residency:</strong> Supabase Postgres is hosted in the EU region for
          EU-resident users.
        </p>
      </section>

      {/* 5. Email */}
      <section aria-labelledby="email" className="mb-[var(--space-6)]">
        <h2 id="email" className="text-2xl">
          5. Email
        </h2>
        <p className="mt-[var(--space-2)]">
          We use <strong>Resend</strong> as our transactional email provider. Resend processes the
          parent email address solely to deliver the two VPC confirmation messages and
          Supabase&rsquo;s own final verification email.
        </p>
        <p className="mt-[var(--space-2)]">
          We do <strong>not</strong> send marketing emails, newsletters, or drip campaigns. The
          parent can request deletion at any time from the Parent Dashboard.
        </p>
      </section>

      {/* 6. Sentry */}
      <section aria-labelledby="sentry" className="mb-[var(--space-6)]">
        <h2 id="sentry" className="text-2xl">
          6. Error Logging
        </h2>
        <p className="mt-[var(--space-2)]">
          We use <strong>Sentry</strong> to capture JavaScript errors so we can fix bugs. Sentry is
          configured to capture errors only — no session replay, no profiling, no performance traces
          beyond a 10% sampling of transaction starts.
        </p>
        <p className="mt-[var(--space-2)]">
          <strong>PII is scrubbed at the SDK level</strong> before the event leaves the browser: a
          regex-based filter redacts
          <code>display_name</code>, <code>email</code>, <code>nickname</code>, and related tokens
          from event messages and breadcrumb bodies.
          <code>sendDefaultPii</code> is disabled, so IPs and identifying headers are not forwarded.
        </p>
        <p className="mt-[var(--space-2)]">
          The Sentry SDK is <strong>DSN-gated</strong>: when the
          <code>NEXT_PUBLIC_SENTRY_DSN</code> environment variable is unset, the SDK does not load
          and no errors are sent anywhere.
        </p>
      </section>

      {/* 7. Plausible */}
      <section aria-labelledby="plausible" className="mb-[var(--space-6)]">
        <h2 id="plausible" className="text-2xl">
          7. Parent Dashboard Analytics
        </h2>
        <p className="mt-[var(--space-2)]">
          The Parent Dashboard area uses <strong>Plausible Analytics</strong> (EU-hosted,
          cookieless) to measure aggregate usage of parent features — for example, how many parents
          complete the VPC upgrade or use the data export tool.
        </p>
        <p className="mt-[var(--space-2)]">
          Plausible does <strong>not</strong> set cookies, does
          <strong> not</strong> capture personal data, and does
          <strong> not</strong> track across sites. No consent banner is required, but we disclose
          it here for transparency. Plausible loads only on <code>/parent/*</code> routes &mdash; no
          child-facing route ever contacts Plausible.
        </p>
      </section>

      {/* 8. Cookies and local storage */}
      <section aria-labelledby="cookies" className="mb-[var(--space-6)]">
        <h2 id="cookies" className="text-2xl">
          8. Cookies &amp; Storage
        </h2>
        <ul className="mt-[var(--space-2)] list-disc pl-[var(--space-6)]">
          <li>
            <strong>IndexedDB (Dexie):</strong> Game state, progress, settings. On-device only.
            Never read by third parties.
          </li>
          <li>
            <strong>localStorage:</strong> Small hints such as &ldquo;onboarding complete&rdquo; and
            locale preference. Cleared when the parent resets the app or clears browser storage.
          </li>
          <li>
            <strong>No cookies on child pages.</strong> The parent dashboard uses a session-scoped
            Supabase auth cookie post-VPC; child sessions never set cookies.
          </li>
        </ul>
      </section>

      {/* 9. Children's rights */}
      <section aria-labelledby="rights" className="mb-[var(--space-6)]">
        <h2 id="rights" className="text-2xl">
          9. Your Rights
        </h2>
        <p className="mt-[var(--space-2)]">
          Under COPPA, GDPR Article 8, and the UK Age-Appropriate Design Code, parents (and
          children) have the right to:
        </p>
        <ul className="mt-[var(--space-2)] list-disc pl-[var(--space-6)]">
          <li>
            <strong>Access</strong> the data we hold &mdash; available instantly via the Parent
            Dashboard.
          </li>
          <li>
            <strong>Rectify</strong> a wrong nickname or age band in Parent Settings.
          </li>
          <li>
            <strong>Erase</strong> everything via the &ldquo;Delete all data&rdquo; flow. A 7-day
            grace window lets you restore if you change your mind.
          </li>
          <li>
            <strong>Port</strong> the data in a portable JSON file via the &ldquo;Data export&rdquo;
            tool, which also reaches the
            <code>parent-export</code> edge function for a server-side DSAR.
          </li>
          <li>
            <strong>Object</strong> to processing by closing and removing the app.
          </li>
          <li>
            <strong>Withdraw consent</strong> to the microphone in Settings without losing other
            progress.
          </li>
          <li>
            <strong>Lodge a complaint</strong> with a supervisory authority (EU/UK), the ICO (UK),
            or the FTC (US).
          </li>
        </ul>
      </section>

      {/* 10. Retention */}
      <section aria-labelledby="retention" className="mb-[var(--space-6)]">
        <h2 id="retention" className="text-2xl">
          10. Data Retention
        </h2>
        <ul className="mt-[var(--space-2)] list-disc pl-[var(--space-6)]">
          <li>
            <strong>Anonymous progress:</strong> auto-purged after 18 months of inactivity.
          </li>
          <li>
            <strong>Audit events:</strong> 90 days (local and cloud).
          </li>
          <li>
            <strong>VPC pending tokens:</strong> 7 days, then automatically expired and deleted.
          </li>
          <li>
            <strong>IP logs (Supabase auth):</strong> 30 days.
          </li>
          <li>
            <strong>Scheduled deletion grace:</strong> 7 days from request, then permanently
            removed.
          </li>
        </ul>
      </section>

      {/* 11. Contact */}
      <section aria-labelledby="contact" className="mb-[var(--space-6)]">
        <h2 id="contact" className="text-2xl">
          11. Contact
        </h2>
        <p className="mt-[var(--space-2)]">
          For any data-subject request or privacy question, write to{' '}
          <strong>{SUPPORT_EMAIL}</strong>.
        </p>
      </section>

      {/* Change log */}
      <section aria-labelledby="changes" className="mb-[var(--space-6)]">
        <h2 id="changes" className="text-2xl">
          Change Log
        </h2>
        <ul
          className="mt-[var(--space-2)] list-disc pl-[var(--space-6)]"
          data-testid="privacy-change-log"
        >
          <li>
            <strong>v1.0 ({PRIVACY_EFFECTIVE_DATE}):</strong> Initial production policy. Covers MVP
            local-first state plus Phase 2 cloud sync (email-plus VPC), Resend transactional email,
            Sentry error logging (DSN-gated, PII scrubbed), Plausible parent-only analytics, and the
            7-day grace-delete flow.
          </li>
          <li>
            <strong>v0.x (Sprint 3 draft):</strong> MVP-only policy. Covered local IndexedDB
            storage, math gate, and on-device microphone policy. Superseded by v1.0.
          </li>
        </ul>
      </section>

      <footer className="mt-[var(--space-8)] text-sm">
        <p>
          See also:{' '}
          <Link href="/" className="underline">
            Home
          </Link>{' '}
          &middot;{' '}
          <Link href="/settings" className="underline">
            Settings
          </Link>
        </p>
      </footer>
    </main>
  );
}
