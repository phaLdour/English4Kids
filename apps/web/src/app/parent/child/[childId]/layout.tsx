import type { ReactNode } from 'react';

/**
 * The `/parent/child/[childId]` route renders the per-learner detail view.
 * The actual child ID is a runtime-only UUID (from Dexie). Mobile static
 * export demands that every dynamic segment have a pre-rendered concrete
 * value, so we ship a single sentinel `me` path:
 *
 *   - On the web SSR build, the `/parent/page.tsx` Manage tile already
 *     rewrites links to `/parent/child/me` (see below) when running
 *     against the static export; the actual child UUID is resolved at
 *     runtime by the page from Dexie.
 *   - On the Capacitor static export, only `/parent/child/me` ships in
 *     the bundle. The page reads the active child ID from Dexie at run
 *     time and looks up the data directly — the URL segment is decorative
 *     when it equals `me`.
 */
export function generateStaticParams(): { childId: string }[] {
  return [{ childId: 'me' }];
}

// We only pre-render `me` so any other concrete UUID would 404 under the
// `output: 'export'` build. The page treats `me` as "resolve from Dexie",
// which is the only navigation entry we surface today.
export const dynamicParams = false;

export default function ChildDetailLayout({ children }: { children: ReactNode }) {
  return children;
}
