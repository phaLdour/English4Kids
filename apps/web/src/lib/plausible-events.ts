/**
 * Typed wrapper around the `window.plausible(...)` global emitted by the
 * Plausible `script.tagged-events.js` bundle.
 *
 * Sprint 5 S5-5. Two ways events reach Plausible:
 *
 *   1. Declarative (preferred for plain buttons): add
 *      `className="plausible-event-name=<name>"` to the element. The
 *      tagged-events script auto-fires the event on click.
 *
 *   2. Programmatic (this module): call `track('event_name', { ...props })`
 *      after a successful async action (e.g. VPC second confirmation). We
 *      no-op safely if Plausible isn't loaded (child routes, SSR, missing
 *      DSN), so callers don't need to guard the import site.
 *
 * Event vocabulary (Sprint 5):
 *   - parent_vpc_request        — parent submits an email to start VPC
 *   - parent_vpc_first_confirm  — first email link clicked, token confirmed
 *   - parent_vpc_complete       — second confirmation succeeded, account upgraded
 *   - parent_export             — parent downloaded the JSON export
 *   - parent_delete_request     — parent scheduled the 7-day grace delete
 *   - parent_sync_enable        — reserved for a future explicit sync toggle;
 *                                 Sprint 5 has no separate UI for this
 *                                 because sync auto-activates after
 *                                 parent_vpc_complete. The event name is
 *                                 listed here so the Plausible dashboard
 *                                 stays forward-compatible.
 *   - parent_mic_enable         — parent toggled the microphone ON
 *
 * Every event MUST be emitted from a `/parent/*` route — we do not track on
 * child-facing routes. The Plausible loader (PlausibleScript) is mounted
 * from `/parent/layout.tsx` only, so `window.plausible` will be undefined
 * on child routes and `track()` will silently no-op.
 */

type PlausibleFn = (event: string, options?: { props?: Record<string, string> }) => void;

interface WindowWithPlausible extends Window {
  plausible?: PlausibleFn;
}

export function track(event: string, props?: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  const w = window as WindowWithPlausible;
  const fn = w.plausible;
  if (typeof fn !== 'function') return;
  if (props) {
    fn(event, { props });
  } else {
    fn(event);
  }
}
