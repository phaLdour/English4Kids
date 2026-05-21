import { promises as fs } from 'node:fs';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { AudioAssetMapSchema } from '@e4k/content-schema';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
// S4-10: pre-render every unitId audio-asset map for static export.
export const dynamic = 'force-static';
export const dynamicParams = false;

function contentRoot(): string {
  return path.resolve(process.cwd(), '..', '..', 'content');
}

export function generateStaticParams(): { unitId: string }[] {
  // Pre-bake one endpoint per unit directory. The audio-assets file lookup
  // accepts both the unit directory name (e.g. `01-me-and-my-world`) and the
  // legacy `unit-01` filename — the GET handler still falls back to `{}` when
  // the file is missing, so listing the unit directory is the safer source.
  const unitsDir = path.join(contentRoot(), 'units');
  try {
    return readdirSync(unitsDir, { withFileTypes: true })
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
  const filePath = path.join(contentRoot(), 'audio-assets', `${unitId}.json`);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch {
    return NextResponse.json({}, { status: 200 });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 500 });
  }
  const result = AudioAssetMapSchema.safeParse(parsed);
  if (!result.success) {
    return NextResponse.json(
      { error: 'schema validation failed', issues: result.error.issues },
      { status: 500 },
    );
  }
  return NextResponse.json(result.data);
}
