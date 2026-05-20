import { promises as fs } from 'node:fs';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { UnitSchema } from '@e4k/content-schema';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
// S4-10: pre-render this endpoint at build time so it survives `output: 'export'`
// for the Capacitor static export. The list of unit IDs comes from the
// `content/units/` directory at build time; there is no runtime fallback.
export const dynamic = 'force-static';
export const dynamicParams = false;

function contentRoot(): string {
  return path.resolve(process.cwd(), '..', '..', 'content');
}

export function generateStaticParams(): { unitId: string }[] {
  const unitsDir = path.join(contentRoot(), 'units');
  try {
    return readdirSync(unitsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => ({ unitId: d.name }));
  } catch {
    // The content dir is missing — happens in pathological CI sandboxes that
    // do not include /content. Returning an empty matrix keeps the build green.
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
  const filePath = path.join(contentRoot(), 'units', unitId, 'manifest.json');
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch {
    return NextResponse.json({ error: 'unit not found' }, { status: 404 });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 500 });
  }
  const result = UnitSchema.safeParse(parsed);
  if (!result.success) {
    return NextResponse.json(
      { error: 'schema validation failed', issues: result.error.issues },
      { status: 500 },
    );
  }
  return NextResponse.json(result.data);
}
