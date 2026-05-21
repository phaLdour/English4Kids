'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';

/**
 * Global footer rendered below every page (inside `Providers` so it can read
 * the active locale from the I18nProvider). Currently just a single
 * "Privacy" link — kept minimal because full-screen game layouts overlay
 * this strip and we never want to interrupt a lesson with chrome.
 *
 * Extracted from `app/layout.tsx` so the link copy can be translated; the
 * layout itself is a server component and cannot use `useTranslations` on
 * its own without pulling in next-intl's server-side machinery (which we
 * deliberately avoid per ADR-0008 — locale lives in Dexie, not in the URL).
 */
export function GlobalFooter() {
  const t = useTranslations();
  return (
    <footer className="px-[var(--space-4)] py-[var(--space-3)] text-center text-xs text-[var(--color-ink)]">
      <Link href="/privacy" className="underline">
        {t('faq.privacyLink')}
      </Link>
    </footer>
  );
}
