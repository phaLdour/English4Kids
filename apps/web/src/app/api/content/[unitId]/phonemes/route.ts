// SAFETY INVARIANTS:
// - Returns pre-computed phoneme arrays only. No raw audio. No POST.

import { promises as fs } from 'node:fs';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
// S4-10: pre-render every unitId phoneme map for static export.
export const dynamic = 'force-static';
export const dynamicParams = false;

function phonemeRoot(): string {
  // public/phonemes/<unitId>.json — co-located with the web app so
  // production deploys include the file in the bundle.
  return path.resolve(process.cwd(), 'public', 'phonemes');
}

function unitsRoot(): string {
  return path.resolve(process.cwd(), '..', '..', 'content', 'units');
}

export function generateStaticParams(): { unitId: string }[] {
  // Source of truth for unit IDs is `content/units/`; not every unit will
  // have a phonemes file (the GET handler already returns `{}` for missing).
  try {
    return readdirSync(unitsRoot(), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => ({ unitId: d.name }));
  } catch {
    return [];
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ unitId: string }> },
) {
  const { unitId } = await params;
  if (!/^[a-z0-9-]+$/i.test(unitId)) {
    return NextResponse.json({ error: 'invalid unitId' }, { status: 400 });
  }
  const filePath = path.join(phonemeRoot(), `${unitId}.json`);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch {
    // Missing maps mean the scorer will award full credit per item — we
    // intentionally return an empty map rather than a 404 to keep the
    // activity non-blocking.
    return NextResponse.json({}, { status: 200 });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 500 });
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return NextResponse.json({ error: 'invalid shape' }, { status: 500 });
  }
  return NextResponse.json(parsed);
}
