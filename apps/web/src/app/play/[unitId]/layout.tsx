import { readdirSync } from 'node:fs';
import path from 'node:path';
import type { ReactNode } from 'react';

/**
 * Pre-render the unit IDs at build time so the static export (Capacitor /
 * mobile target) includes a directory per unit. The dynamic page component is
 * a `'use client'` file and cannot host `generateStaticParams` itself; this
 * server-side layout owns that responsibility.
 */
export function generateStaticParams(): { unitId: string }[] {
  // Resolve `content/units/*` relative to the repo root. In CI / Vercel
  // builds `process.cwd()` is `apps/web`, so we step up two levels.
  const contentRoot = path.resolve(process.cwd(), '..', '..', 'content', 'units');
  try {
    return readdirSync(contentRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => ({ unitId: d.name }));
  } catch {
    // Pathological build envs without the content directory get an empty
    // matrix so the build still succeeds; runtime routes will 404 cleanly.
    return [];
  }
}

// `output: 'export'` builds reject dynamic routes that have not been
// pre-rendered. We have no need for on-demand unit IDs at runtime.
export const dynamicParams = false;

export default function PlayUnitLayout({ children }: { children: ReactNode }) {
  return children;
}
