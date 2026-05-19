import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

export function GET() {
  return NextResponse.json({ ok: true, version: '0.1.0' });
}
