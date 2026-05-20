'use client';

/**
 * Parent landing page — Sprint 5 S5-10.
 *
 * Public, unauthenticated entry point for grown-ups evaluating the app before
 * handing it to a child. Intentionally minimal:
 *   - Two-colour palette (cream `--color-surface` + sky-blue accents).
 *   - Large readable type, Atkinson Hyperlegible body + Fredoka headings via
 *     the existing `--font-display` / `--font-body` tokens.
 *   - No tracking. Plausible is mounted only under `/parent/*`; this route
 *     does NOT load Plausible because parents may share the URL with kids
 *     and the route is also indexable by search engines.
 *
 * We mark the file `use client` because the project's i18n provider is a
 * client-side `next-intl` provider hydrated from Dexie (see ADR-0008). The
 * page itself has no state and no effects, so the client-component overhead
 * is just the next-intl runtime — a one-time cost the rest of the app
 * already pays.
 *
 * Linked from:
 *   - The root `/` route's onboarding redirect (parents can navigate here
 *     manually before handing off to their child).
 *   - `/faq` footer (sibling page).
 *   - `/privacy` footer (sibling page).
 *   - External: future blog posts, press kit, app store listings.
 */

import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function MarketingPage(): React.JSX.Element {
  const t = useTranslations('marketing');

  return (
    <main
      className="min-h-dvh bg-[var(--color-surface)] text-[var(--color-ink)]"
      data-testid="marketing-page"
    >
      {/* ---- Hero ---- */}
      <section
        aria-labelledby="hero-title"
        className="mx-auto max-w-4xl px-[var(--space-5)] py-[var(--space-10)] text-center"
      >
        <p
          className="text-sm uppercase tracking-wide text-[var(--color-primary-dark)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t('title')}
        </p>
        <h1
          id="hero-title"
          className="mt-[var(--space-3)] text-4xl md:text-5xl text-[var(--color-primary-dark)]"
          style={{ fontFamily: 'var(--font-display)', lineHeight: 1.15 }}
        >
          {t('tagline')}
        </h1>
        <p
          className="mx-auto mt-[var(--space-4)] max-w-2xl text-lg md:text-xl leading-relaxed"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {t('subhead')}
        </p>

        {/*
          Hero illustration: pair shot of Milo + Luna. Decorative — the
          surrounding text already announces the brand. The two SVGs are part
          of the unit-01 asset set; if either 404s the page still reads
          cleanly (no broken alt text).
        */}
        <div
          aria-hidden="true"
          className="mx-auto mt-[var(--space-6)] flex max-w-md items-end justify-center gap-[var(--space-4)]"
        >
          <img
            src="/img/mascots/milo-wave.svg"
            alt=""
            className="h-32 w-32 md:h-40 md:w-40"
            loading="eager"
          />
          <img
            src="/img/mascots/luna-wave.svg"
            alt=""
            className="h-32 w-32 md:h-40 md:w-40"
            loading="eager"
          />
        </div>

        <div className="mt-[var(--space-6)]">
          <Link
            href="/onboarding"
            aria-label={t('cta.openAppAria')}
            className="inline-block rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-[var(--space-6)] py-[var(--space-3)] text-lg text-[var(--color-surface-high)] shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-milo)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t('cta.openApp')}
          </Link>
        </div>
      </section>

      {/* ---- Feature cards ---- */}
      <section
        aria-labelledby="features-title"
        className="mx-auto max-w-5xl px-[var(--space-5)] py-[var(--space-8)]"
      >
        <h2 id="features-title" className="sr-only">
          Features
        </h2>
        <ul className="grid gap-[var(--space-5)] md:grid-cols-3">
          {[
            { key: 'privacy', icon: 'shield' },
            { key: 'pedagogy', icon: 'leaf' },
            { key: 'ageBands', icon: 'star' },
          ].map((feature) => (
            <li
              key={feature.key}
              className="rounded-[var(--radius-card)] bg-[var(--color-surface-high)] p-[var(--space-5)] shadow-[var(--shadow-soft)]"
            >
              <h3
                className="text-xl text-[var(--color-primary-dark)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {t(`features.${feature.key}.title`)}
              </h3>
              <p
                className="mt-[var(--space-3)] leading-relaxed"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {t(`features.${feature.key}.body`)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- How it works ---- */}
      <section
        aria-labelledby="how-title"
        className="mx-auto max-w-4xl px-[var(--space-5)] py-[var(--space-8)]"
      >
        <h2
          id="how-title"
          className="text-2xl md:text-3xl text-[var(--color-primary-dark)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t('howItWorks.title')}
        </h2>
        <ol className="mt-[var(--space-5)] grid gap-[var(--space-5)] md:grid-cols-3">
          {(['step1', 'step2', 'step3'] as const).map((step, idx) => (
            <li
              key={step}
              className="rounded-[var(--radius-card)] border-2 border-[var(--color-primary)] p-[var(--space-5)]"
            >
              <span
                aria-hidden="true"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)] text-[var(--color-surface-high)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {idx + 1}
              </span>
              <h3
                className="mt-[var(--space-3)] text-lg text-[var(--color-primary-dark)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {t(`howItWorks.${step}Title`)}
              </h3>
              <p
                className="mt-[var(--space-2)] leading-relaxed"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {t(`howItWorks.${step}Body`)}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---- Privacy + safety ---- */}
      <section
        aria-labelledby="privacy-title"
        className="mx-auto max-w-4xl px-[var(--space-5)] py-[var(--space-8)]"
      >
        <div className="rounded-[var(--radius-card)] bg-[var(--color-surface-high)] p-[var(--space-6)] shadow-[var(--shadow-soft)]">
          <h2
            id="privacy-title"
            className="text-2xl md:text-3xl text-[var(--color-primary-dark)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t('privacy.title')}
          </h2>
          <ul
            className="mt-[var(--space-4)] list-disc space-y-[var(--space-2)] pl-[var(--space-6)]"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <li>{t('privacy.bullet1')}</li>
            <li>{t('privacy.bullet2')}</li>
            <li>{t('privacy.bullet3')}</li>
            <li>{t('privacy.bullet4')}</li>
          </ul>
          <p className="mt-[var(--space-4)]">
            <Link href="/privacy" className="text-[var(--color-primary-dark)] underline">
              {t('privacy.readMore')}
            </Link>
          </p>
        </div>
      </section>

      {/* ---- Final CTA ---- */}
      <section className="mx-auto max-w-3xl px-[var(--space-5)] py-[var(--space-10)] text-center">
        <Link
          href="/onboarding"
          aria-label={t('cta.openAppAria')}
          className="inline-block rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-[var(--space-8)] py-[var(--space-4)] text-xl text-[var(--color-surface-high)] shadow-[var(--shadow-milo)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t('cta.openApp')}
        </Link>
      </section>

      {/* ---- Footer ---- */}
      <footer
        className="mx-auto max-w-4xl border-t border-[var(--color-primary)]/30 px-[var(--space-5)] py-[var(--space-6)] text-sm"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        <p className="text-center text-[var(--color-ink)]">{t('footer.tagline')}</p>
        <nav
          aria-label="Footer"
          className="mt-[var(--space-3)] flex flex-wrap items-center justify-center gap-[var(--space-4)]"
        >
          <span>{t('footer.contact')}</span>
          <span aria-hidden="true">·</span>
          <Link href="/privacy" className="underline">
            {t('footer.privacy')}
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/faq" className="underline">
            {t('footer.faq')}
          </Link>
          <span aria-hidden="true">·</span>
          {/* Terms page is deferred to Sprint 6; the link is a placeholder
              so the IA reads completely even before the document exists. */}
          <span className="text-[var(--color-ink)]/60">{t('footer.terms')}</span>
        </nav>
      </footer>
    </main>
  );
}
