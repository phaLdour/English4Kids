import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy — English4Kids',
  description: 'How we keep children safe. Plain-language privacy policy.',
};

/**
 * Privacy policy.
 *
 * Mirrors the Sprint 1 Safety Officer output. Plain language; no decorative
 * UI; intentionally text-first so screen readers and parents on slow links
 * can read it without surprises.
 *
 * The summary at the top is targeted at children (~grade 3 readability);
 * the body is targeted at parents (~grade 8). The companion
 * `/privacy/parent-summary` page collapses the body to a single paragraph.
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
        <p className="mt-[var(--space-2)] text-sm">
          Effective date: 19 May 2026 &middot;{' '}
          <Link href="/privacy/parent-summary" className="underline">
            Parent quick summary
          </Link>
        </p>
      </header>

      <section aria-labelledby="kid-summary" className="mb-[var(--space-6)]">
        <h2 id="kid-summary" className="text-2xl">
          A note for kids
        </h2>
        <p className="mt-[var(--space-2)] text-lg">
          Hi! We made this app to help you learn English with Milo and Bea. We
          try really hard to keep you safe. We do not ask for your real name.
          We do not save the sound of your voice. We do not tell other
          companies about you. If you ever want to stop, you can just close
          the app and everything you saved stays on your own device.
        </p>
      </section>

      <section aria-labelledby="controller" className="mb-[var(--space-6)]">
        <h2 id="controller" className="text-2xl">
          1. Who runs this app
        </h2>
        <p className="mt-[var(--space-2)]">
          English4Kids is run by the English4Kids team. We are the data
          controller for the small amount of information described below. You
          can reach us at <a className="underline" href="mailto:privacy@english4kids.example">privacy@english4kids.example</a>.
        </p>
      </section>

      <section aria-labelledby="data" className="mb-[var(--space-6)]">
        <h2 id="data" className="text-2xl">
          2. What we keep, and why
        </h2>
        <p className="mt-[var(--space-2)]">
          Everything we keep lives on the device your child plays on. We do
          not send it to our servers in the current version. The table below
          lists every category.
        </p>
        <div className="mt-[var(--space-4)] overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-ink)]">
                <th className="py-[var(--space-2)] pr-[var(--space-3)]">Data</th>
                <th className="py-[var(--space-2)] pr-[var(--space-3)]">Purpose</th>
                <th className="py-[var(--space-2)]">Legal basis</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[var(--color-ink)] align-top">
                <td className="py-[var(--space-2)] pr-[var(--space-3)]">
                  Display name (an animal nickname only, e.g. &ldquo;Friend&rdquo;)
                </td>
                <td className="py-[var(--space-2)] pr-[var(--space-3)]">
                  Personalising the UI so the mascot can greet your child.
                </td>
                <td className="py-[var(--space-2)]">Legitimate interest</td>
              </tr>
              <tr className="border-b border-[var(--color-ink)] align-top">
                <td className="py-[var(--space-2)] pr-[var(--space-3)]">Age band (6&ndash;8 or 9&ndash;12)</td>
                <td className="py-[var(--space-2)] pr-[var(--space-3)]">
                  Picking age-appropriate activities and tap-target sizes.
                </td>
                <td className="py-[var(--space-2)]">Legitimate interest</td>
              </tr>
              <tr className="border-b border-[var(--color-ink)] align-top">
                <td className="py-[var(--space-2)] pr-[var(--space-3)]">Progress scores (stars, mastered words)</td>
                <td className="py-[var(--space-2)] pr-[var(--space-3)]">
                  Resuming where your child left off and showing the parent
                  dashboard.
                </td>
                <td className="py-[var(--space-2)]">Legitimate interest</td>
              </tr>
              <tr className="border-b border-[var(--color-ink)] align-top">
                <td className="py-[var(--space-2)] pr-[var(--space-3)]">
                  Pronunciation score (a number from 0 to 1)
                </td>
                <td className="py-[var(--space-2)] pr-[var(--space-3)]">
                  Choosing the right difficulty for Speak-It activities.{' '}
                  <strong>No audio is collected.</strong>
                </td>
                <td className="py-[var(--space-2)]">Legitimate interest</td>
              </tr>
              <tr className="align-top">
                <td className="py-[var(--space-2)] pr-[var(--space-3)]">
                  Settings (volume, captions, dyslexia font, reduced motion,
                  mic on/off, strictness)
                </td>
                <td className="py-[var(--space-2)] pr-[var(--space-3)]">
                  Remembering how the app should look and sound.
                </td>
                <td className="py-[var(--space-2)]">Legitimate interest</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-[var(--space-3)]">
          We do <strong>not</strong> collect: email addresses, phone numbers, real
          names, exact ages, location, contact lists, photos, video, audio
          recordings, or persistent advertising identifiers. We do not place
          third-party trackers on any page a child can see.
        </p>
      </section>

      <section aria-labelledby="mic" className="mb-[var(--space-6)]">
        <h2 id="mic" className="text-2xl">
          3. The microphone
        </h2>
        <p className="mt-[var(--space-2)]">
          The microphone is off until a grown-up turns it on through a math
          challenge (Parent Gate). When it is on, audio is processed{' '}
          <strong>on the device</strong> and is never sent to our servers. There
          are two engines a parent may pick:
        </p>
        <ul className="mt-[var(--space-2)] list-disc pl-[var(--space-6)]">
          <li>
            <strong>Web Speech</strong> (the browser default). Chrome may route
            some words to Google&rsquo;s speech service to recognise them. This
            is the browser&rsquo;s behaviour, not ours. We disclose it here
            because Chrome does not always make it obvious.
          </li>
          <li>
            <strong>Offline engine (whisper.cpp WASM)</strong>. Runs entirely on
            the device. No words leave the device, ever. Recommended if you
            want zero network traffic from the microphone.
          </li>
        </ul>
        <p className="mt-[var(--space-2)]">
          When the microphone is active a red dot appears in the top bar. A
          parent can switch the microphone off at any time in Settings.
        </p>
      </section>

      <section aria-labelledby="legal" className="mb-[var(--space-6)]">
        <h2 id="legal" className="text-2xl">
          4. Legal bases we rely on
        </h2>
        <ul className="mt-[var(--space-2)] list-disc pl-[var(--space-6)]">
          <li>
            <strong>COPPA</strong> (Children&rsquo;s Online Privacy Protection
            Act, 16 CFR Part 312) for users in the United States.
          </li>
          <li>
            <strong>GDPR Article 6(1)(f)</strong> (legitimate interests) for
            the on-device personalisation described above. Our legitimate
            interest is delivering an age-appropriate learning experience and
            is balanced against the rights of the child by the data
            minimisation built into the product.
          </li>
          <li>
            <strong>GDPR Article 8</strong> on children&rsquo;s consent in the
            information-society-service context. Because we do not transmit
            personal data and we operate the Parent Gate before any optional
            feature, we do not currently rely on parental consent under
            Article 8; if that changes (Phase 2 sync) we will collect verifiable
            parental consent by email plus confirmation.
          </li>
        </ul>
      </section>

      <section aria-labelledby="retention" className="mb-[var(--space-6)]">
        <h2 id="retention" className="text-2xl">
          5. How long we keep things
        </h2>
        <p className="mt-[var(--space-2)]">
          All data lives on the child&rsquo;s device and is retained until the
          parent resets the app or clears browser storage. When optional cloud
          sync activates (Phase 2), we will auto-purge any account that has
          had no activity for <strong>18 months</strong>.
        </p>
      </section>

      <section aria-labelledby="rights" className="mb-[var(--space-6)]">
        <h2 id="rights" className="text-2xl">
          6. Parental rights
        </h2>
        <p className="mt-[var(--space-2)]">
          A parent may, at any time:
        </p>
        <ul className="mt-[var(--space-2)] list-disc pl-[var(--space-6)]">
          <li>Access the data on the device (the Parent Dashboard shows it).</li>
          <li>Rectify a wrong nickname or age band via Settings.</li>
          <li>Erase everything via the &ldquo;Reset progress&rdquo; button or by clearing browser storage.</li>
          <li>Export the data in a portable JSON format (Phase 2 feature).</li>
          <li>Restrict or object to processing by closing the app and removing it.</li>
          <li>Withdraw consent to the microphone in Settings without losing other progress.</li>
          <li>Lodge a complaint with a supervisory authority (EU/UK) or with the FTC (US).</li>
        </ul>
        <p className="mt-[var(--space-2)]">
          To make a request that we cannot handle locally, email{' '}
          <a className="underline" href="mailto:privacy@english4kids.example">privacy@english4kids.example</a>.
          We will respond within 30 days.
        </p>
      </section>

      <section aria-labelledby="coppa" className="mb-[var(--space-6)]">
        <h2 id="coppa" className="text-2xl">
          7. COPPA notice (United States)
        </h2>
        <p className="mt-[var(--space-2)]">
          We do not knowingly collect personal information from children under
          13 within the meaning of COPPA. The only identifiers we store are a
          random device key created in the browser and the optional nickname.
          If you believe we have inadvertently collected personal information,
          please email us and we will erase it.
        </p>
      </section>

      <section aria-labelledby="cookies" className="mb-[var(--space-6)]">
        <h2 id="cookies" className="text-2xl">
          8. Cookies and storage
        </h2>
        <p className="mt-[var(--space-2)]">
          We use only essential browser storage (IndexedDB and localStorage)
          to save progress and settings. We do not set marketing or analytics
          cookies on pages a child can reach. The parent dashboard area may in
          a future release include privacy-respecting analytics (Plausible,
          self-hosted, no personal data), which will be disclosed here when
          enabled.
        </p>
      </section>

      <section aria-labelledby="changes" className="mb-[var(--space-6)]">
        <h2 id="changes" className="text-2xl">
          9. Changes to this policy
        </h2>
        <p className="mt-[var(--space-2)]">
          If we change this policy we will update the effective date and post
          a short summary on the home screen for at least 30 days. Material
          changes that affect data we collect will require a parent to
          re-confirm in the Parent Gate.
        </p>
        <ul className="mt-[var(--space-2)] list-disc pl-[var(--space-6)]">
          <li>2026-05-19 &mdash; Initial policy.</li>
        </ul>
      </section>

      <section aria-labelledby="contact" className="mb-[var(--space-6)]">
        <h2 id="contact" className="text-2xl">
          10. Contact
        </h2>
        <p className="mt-[var(--space-2)]">
          Data subject requests:{' '}
          <a className="underline" href="mailto:privacy@english4kids.example">
            privacy@english4kids.example
          </a>
          . Postal address available on request.
        </p>
      </section>

      <footer className="mt-[var(--space-8)] text-sm">
        <p>
          See also: <Link href="/" className="underline">Home</Link> &middot;{' '}
          <Link href="/settings" className="underline">Settings</Link>
        </p>
      </footer>
    </main>
  );
}
