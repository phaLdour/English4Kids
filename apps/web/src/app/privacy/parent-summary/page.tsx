import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Parent Privacy Summary — English4Kids',
  description: 'One-paragraph parent-readable summary of how we handle data.',
};

/**
 * One-paragraph version of the full policy. Aimed at a parent skimming on a
 * phone in a school pickup line. Always link back to the full policy.
 */
export default function ParentSummaryPage(): React.JSX.Element {
  return (
    <main className="mx-auto max-w-2xl bg-[var(--color-surface)] px-[var(--space-5)] py-[var(--space-8)] text-[var(--color-ink)]">
      <h1
        className="text-3xl text-[var(--color-primary-dark)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Privacy in one paragraph
      </h1>
      <p className="mt-[var(--space-4)] text-lg leading-relaxed">
        English4Kids stores progress, settings, an age band, and an optional
        animal nickname <strong>on your child&rsquo;s device only</strong>. We do not
        record audio &mdash; the microphone, when you turn it on, processes
        speech on-device and the score is just a number. We do not run
        advertising, analytics, or social-media trackers on any page your
        child can see. You can reset everything at any time from Settings,
        and you can email{' '}
        <a className="underline" href="mailto:privacy@english4kids.example">
          privacy@english4kids.example
        </a>{' '}
        for any data-subject request.
      </p>
      <p className="mt-[var(--space-4)]">
        <Link href="/privacy" className="underline">
          Read the full privacy policy
        </Link>
        .
      </p>
    </main>
  );
}
