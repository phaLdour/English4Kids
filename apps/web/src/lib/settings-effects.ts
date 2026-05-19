/**
 * Apply user settings to the DOM (theme, body classes).
 *
 * Pure module: callable from anywhere in the browser. Safe to invoke on the
 * server (it bails immediately if `document` is undefined). Re-callable; each
 * invocation reconciles class state to the values passed in — there is no
 * accumulated state.
 */

export interface AppliedSettings {
  /** `contrast.high` — toggles `[data-theme="high-contrast"]` on <html>. */
  contrastHigh: boolean;
  /** `font.dyslexia` — toggles `.font-dyslexia` on <body>. */
  fontDyslexia: boolean;
  /** `motion.reduced` — toggles `.motion-reduced` on <body>. */
  motionReduced: boolean;
}

/** Coerce arbitrary stored values to booleans without using `any`. */
function asBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return fallback;
}

/** Extract the three DOM-affecting settings from a settings record. */
export function pickAppliedSettings(settings: Record<string, unknown>): AppliedSettings {
  return {
    contrastHigh: asBool(settings['contrast.high']),
    fontDyslexia: asBool(settings['font.dyslexia']),
    motionReduced: asBool(settings['motion.reduced']),
  };
}

/**
 * Reconcile the DOM with the given settings. Safe no-op outside the browser.
 */
export function applySettingsToDom(settings: Record<string, unknown>): void {
  if (typeof document === 'undefined') return;
  const applied = pickAppliedSettings(settings);

  const root = document.documentElement;
  root.dataset.theme = applied.contrastHigh ? 'high-contrast' : 'default';

  const body = document.body;
  if (body) {
    body.classList.toggle('font-dyslexia', applied.fontDyslexia);
    body.classList.toggle('motion-reduced', applied.motionReduced);
  }
}
