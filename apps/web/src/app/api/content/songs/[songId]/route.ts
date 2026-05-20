import { promises as fs } from 'node:fs';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { SongLyricSchema } from '@e4k/content-schema';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
// S4-10: pre-render every song id for static export.
export const dynamic = 'force-static';
export const dynamicParams = false;

function contentRoot(): string {
  return path.resolve(process.cwd(), '..', '..', 'content');
}

export function generateStaticParams(): { songId: string }[] {
  const songsDir = path.join(contentRoot(), 'songs');
  try {
    return readdirSync(songsDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => ({ songId: f.replace(/\.json$/, '') }));
  } catch {
    return [];
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ songId: string }> },
) {
  const { songId } = await params;
  if (!/^[a-z0-9-]+$/i.test(songId)) {
    return NextResponse.json({ error: 'invalid songId' }, { status: 400 });
  }
  const filePath = path.join(contentRoot(), 'songs', `${songId}.json`);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch {
    return NextResponse.json({ error: 'song not found' }, { status: 404 });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 500 });
  }
  const result = SongLyricSchema.safeParse(parsed);
  if (!result.success) {
    return NextResponse.json(
      { error: 'schema validation failed', issues: result.error.issues },
      { status: 500 },
    );
  }
  return NextResponse.json(result.data);
}
