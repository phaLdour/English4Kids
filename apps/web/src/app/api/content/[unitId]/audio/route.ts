import { promises as fs } from 'node:fs';
import path from 'node:path';
import { AudioAssetMapSchema } from '@e4k/content-schema';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function contentRoot(): string {
  return path.resolve(process.cwd(), '..', '..', 'content');
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
