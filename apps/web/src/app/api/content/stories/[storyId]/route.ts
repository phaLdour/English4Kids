import { promises as fs } from 'node:fs';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { StoryPanelSchema, StoryQuestionSchema } from '@e4k/content-schema';

export const runtime = 'nodejs';
// S4-10: pre-render every story id for static export.
export const dynamic = 'force-static';
export const dynamicParams = false;

const StoryDocSchema = z.object({
  id: z.string(),
  title: z.string(),
  ageBand: z.enum(['6-8', '9-12']),
  panels: z.array(StoryPanelSchema),
  questions: z.array(StoryQuestionSchema),
});

function contentRoot(): string {
  return path.resolve(process.cwd(), '..', '..', 'content');
}

export function generateStaticParams(): { storyId: string }[] {
  const storiesDir = path.join(contentRoot(), 'stories');
  try {
    return readdirSync(storiesDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => ({ storyId: f.replace(/\.json$/, '') }));
  } catch {
    return [];
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ storyId: string }> },
) {
  const { storyId } = await params;
  if (!/^[a-z0-9-]+$/i.test(storyId)) {
    return NextResponse.json({ error: 'invalid storyId' }, { status: 400 });
  }
  const filePath = path.join(contentRoot(), 'stories', `${storyId}.json`);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch {
    return NextResponse.json({ error: 'story not found' }, { status: 404 });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 500 });
  }
  const result = StoryDocSchema.safeParse(parsed);
  if (!result.success) {
    return NextResponse.json(
      { error: 'schema validation failed', issues: result.error.issues },
      { status: 500 },
    );
  }
  return NextResponse.json(result.data);
}
