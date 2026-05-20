'use client';

/**
 * FAQ — Sprint 5 S5-10.
 *
 * Twelve plain-language questions across three categories:
 *   - For parents (5)
 *   - For kids, read with a grown-up (3)
 *   - Technical (4)
 *
 * Linked from the marketing page footer and the parent dashboard. Like the
 * marketing page, this is `use client` because the project's next-intl
 * provider is client-side (ADR-0008). The page has no state — every render
 * is identical given the active locale.
 *
 * Copy guidelines (re-asserted from the Sprint 5 design log):
 *   - Process-praise tone: "your brain grows" beats "you are smart".
 *   - No banned phrasings (no "wrong", "fail", "stupid", "smart").
 *   - 2-4 sentences per answer; aim for grade 6 readability.
 *   - Privacy answers stay synchronised with the privacy policy v1.0.
 */

import { useTranslations } from 'next-intl';
import Link from 'next/link';

interface QA {
  /** Translation-key fragment, e.g. `parents.privacy` → `faq.parents.privacy.q/a`. */
  readonly id: string;
}

const PARENT_QUESTIONS: readonly QA[] = [
  { id: 'parents.privacy' },
  { id: 'parents.micAudio' },
  { id: 'parents.delete' },
  { id: 'parents.controls' },
  { id: 'parents.vpc' },
];

const KID_QUESTIONS: readonly QA[] = [
  { id: 'kids.offline' },
  { id: 'kids.milo' },
  { id: 'kids.scores' },
];

const TECHNICAL_QUESTIONS: readonly QA[] = [
  { id: 'technical.browsers' },
  { id: 'technical.internet' },
  { id: 'technical.languages' },
  { id: 'technical.support' },
];

/**
 * Translation function bound to the `faq` namespace. We keep the prop
 * loosely typed because next-intl's strict-mode generic typing requires a
 * messages declaration file the project has not adopted yet; the tests
 * cover key coverage end-to-end instead.
 */
type FaqT = (key: string) => string;

interface CategoryProps {
  readonly headingId: string;
  readonly heading: string;
  readonly questions: readonly QA[];
  readonly t: FaqT;
}

function Category({ headingId, heading, questions, t }: CategoryProps): React.JSX.Element {
  return (
    <section
      aria-labelledby={headingId}
      className="mt-[var(--space-7)] first-of-type:mt-[var(--space-4)]"
    >
      <h2
        id={headingId}
        className="text-2xl text-[var(--color-primary-dark)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {heading}
      </h2>
      <dl className="mt-[var(--space-4)] space-y-[var(--space-5)]">
        {questions.map((qa) => (
          <div
            key={qa.id}
            className="rounded-[var(--radius-card)] bg-[var(--color-surface-high)] p-[var(--space-4)] shadow-[var(--shadow-soft)]"
          >
            <dt
              className="text-lg text-[var(--color-primary-dark)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {t(`${qa.id}.q`)}
            </dt>
            <dd
              className="mt-[var(--space-2)] leading-relaxed"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {t(`${qa.id}.a`)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function FaqPage(): React.JSX.Element {
  // The next-intl typings here resolve to a deep-keyed callable; we narrow
  // to the simpler signature the `Category` helper expects.
  const t = useTranslations('faq') as unknown as FaqT;

  return (
    <main
      className="mx-auto max-w-3xl bg-[var(--color-surface)] px-[var(--space-5)] py-[var(--space-8)] text-[var(--color-ink)]"
      data-testid="faq-page"
    >
      <header>
        <h1
          className="text-3xl text-[var(--color-primary-dark)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t('title')}
        </h1>
        <p
          className="mt-[var(--space-3)] leading-relaxed"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {t('intro')}
        </p>
      </header>

      <Category
        headingId="cat-parents"
        heading={t('categories.parents')}
        questions={PARENT_QUESTIONS}
        t={t}
      />
      <Category
        headingId="cat-kids"
        heading={t('categories.kids')}
        questions={KID_QUESTIONS}
        t={t}
      />
      <Category
        headingId="cat-technical"
        heading={t('categories.technical')}
        questions={TECHNICAL_QUESTIONS}
        t={t}
      />

      <footer className="mt-[var(--space-8)] flex flex-wrap items-center justify-between gap-[var(--space-3)] text-sm">
        <Link href="/marketing" className="underline">
          {t('backTo')}
        </Link>
        <Link href="/privacy" className="underline">
          {/* Privacy footer link kept consistent with the marketing page. */}
          Privacy
        </Link>
      </footer>
    </main>
  );
}
