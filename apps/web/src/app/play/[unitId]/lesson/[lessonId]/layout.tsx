import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { ReactNode } from 'react';

/**
 * Pre-render the unit×lesson matrix at build time so the static export
 * includes a directory per (unit, lesson). The dynamic page is a
 * `'use client'` file; this server-side layout owns the static params.
 */
export function generateStaticParams(): { unitId: string; lessonId: string }[] {
  const unitsDir = path.resolve(process.cwd(), '..', '..', 'content', 'units');
  const out: { unitId: string; lessonId: string }[] = [];
  try {
    for (const unit of readdirSync(unitsDir, { withFileTypes: true })) {
      if (!unit.isDirectory()) continue;
      const manifestPath = path.join(unitsDir, unit.name, 'manifest.json');
      try {
        const raw = readFileSync(manifestPath, 'utf8');
        const parsed = JSON.parse(raw) as { lessons?: Array<{ id?: string }> };
        for (const lesson of parsed.lessons ?? []) {
          if (typeof lesson?.id === 'string') {
            out.push({ unitId: unit.name, lessonId: lesson.id });
          }
        }
      } catch {
        // Skip malformed unit manifests; the validator gate catches them
        // upstream so reaching this branch means the content tree drifted
        // between validate-content and build.
      }
    }
  } catch {
    // Content tree missing — return [] so the build succeeds.
  }
  return out;
}

export const dynamicParams = false;

export default function PlayLessonLayout({ children }: { children: ReactNode }) {
  return children;
}
