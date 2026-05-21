import { promises as fs } from 'node:fs';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { UnitSchema } from '@e4k/content-schema';
import { NextResponse } from 'next/server';

/**
 * Units index — a flat list of every shipped unit's `{ id, title, summary }`.
 *
 * Why this exists: the play home page (`/play`) used to hard-code a single
 * unit ID, which meant kids could only reach unit 01 even though units 02 and
 * 03 were fully authored and prerendered. This route makes the full set
 * discoverable without forcing every consumer to crawl `content/units/*`
 * directly (the play home is a `'use client'` component and cannot read the
 * filesystem; the route handler can).
 *
 * Strategy:
 *   - Built at build time (`dynamic = 'force-static'`) so it works with the
 *     Capacitor static export.
 *   - Returns ONLY the metadata the home page needs (id, title, summary).
 *     The full lesson tree still loads on demand via `getUnit(id)`.
 *   - Skips units that fail schema validation. A broken unit in `content/`
 *     should not 500 the index — it should just not appear, and the next
 *     content-validation gate will catch it.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-static';

interface UnitIndexEntry {
  id: string;
  title: string;
  theme: string;
  orderIndex: number;
  lessonCount: number;
}

function contentRoot(): string {
  return path.resolve(process.cwd(), '..', '..', 'content');
}

export async function GET(): Promise<NextResponse> {
  const unitsDir = path.join(contentRoot(), 'units');
  let entries: string[];
  try {
    entries = readdirSync(unitsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
  } catch {
    return NextResponse.json({ units: [] satisfies UnitIndexEntry[] });
  }

  const units: UnitIndexEntry[] = [];
  for (const unitId of entries) {
    const filePath = path.join(unitsDir, unitId, 'manifest.json');
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      const result = UnitSchema.safeParse(parsed);
      if (!result.success) continue;
      units.push({
        id: result.data.id,
        title: result.data.title,
        theme: result.data.theme,
        orderIndex: result.data.orderIndex,
        lessonCount: result.data.lessons.length,
      });
    } catch {
      // Skip malformed units — content-validate-content gate will surface them.
    }
  }

  units.sort((a, b) => a.orderIndex - b.orderIndex);
  return NextResponse.json({ units });
}
