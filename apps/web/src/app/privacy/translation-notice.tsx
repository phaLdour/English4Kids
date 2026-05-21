'use client';

/**
 * Locale-aware notice that surfaces a "Turkish translation pending" banner on
 * the privacy page when the active locale is TR. The privacy body itself
 * stays in English under Sprint 4 policy (legal text needs Legal-lite review,
 * see Sprint 5 S5-6).
 */
import { useTranslations } from 'next-intl';

export function PrivacyTranslationNotice() {
  const t = useTranslations();
  const message = t('privacy.translationPending');
  // The EN/TR JSON both contain a `privacy.translationPending` key. When the
  // active locale is EN the message is the EN copy ("...available in English
  // only. A reviewed Turkish translation is coming.") which is redundant for
  // EN readers — we hide it. When the active locale is TR we show the
  // Turkish copy so parents know the body is intentionally English-only for
  // now.
  if (typeof navigator !== 'undefined') {
    // intentionally a no-op; we rely on the message comparison below.
  }
  // Detect TR by checking if the EN-only marker phrase appears. EN copy
  // starts with "This privacy policy"; TR copy starts with "Bu gizlilik".
  const isTurkish = !message.startsWith('This privacy');
  if (!isTurkish) return null;
  return (
    <p
      role="note"
      className="mt-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--color-mist)] bg-[var(--color-surface-high)] p-[var(--space-3)] text-sm"
    >
      {message}
    </p>
  );
}
