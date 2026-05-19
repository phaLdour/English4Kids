'use client';

/**
 * Account upgrade placeholder.
 *
 * MVP is anonymous + math-gate only (Safety Officer policy). Email-plus VPC
 * is deferred until Phase 2. This page sets the parent's expectation that
 * cloud-sync is a thoughtful future addition, not a missing feature — and
 * frames the device-local default as a privacy win.
 */

import Link from 'next/link';

export default function AccountUpgradePage() {
  return (
    <main
      data-testid="parent-account"
      className="mx-auto flex w-full max-w-2xl flex-col gap-[var(--space-6)] px-[var(--space-4)] py-[var(--space-6)] pb-[var(--space-16)]"
    >
      <section
        aria-label="Account upgrade"
        className="flex flex-col gap-[var(--space-3)] rounded-[var(--radius-lg)] bg-[var(--color-surface-high)] p-[var(--space-6)] shadow-[var(--shadow-card)]"
      >
        <h1
          className="text-2xl text-[var(--color-primary-dark)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Account upgrade
        </h1>
        <p className="text-base text-[var(--color-ink)]">
          Cloud sync and multi-device support are coming in a future update. For now, your
          child&rsquo;s progress lives on this device only — and that&rsquo;s a privacy
          feature.
        </p>
        <p className="text-sm text-[var(--color-mist)]">
          No account is required to use English4Kids. The parent dashboard, settings, export,
          and delete all work without one.
        </p>
        <Link
          href="/parent"
          className="self-start rounded-[var(--radius-pill)] bg-[var(--color-surface)] px-[var(--space-6)] py-[var(--space-3)] text-[var(--color-ink)]"
          style={{ minHeight: '48px', fontFamily: 'var(--font-display)' }}
        >
          Back to dashboard
        </Link>
      </section>
    </main>
  );
}
