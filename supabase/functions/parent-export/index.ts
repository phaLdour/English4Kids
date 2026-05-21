/**
 * parent-export — GDPR / COPPA data subject access (DSAR).
 *
 * Returns a complete JSON dump of the calling parent's profile, their
 * children, and every dependent row (progress, vocab_state,
 * pronunciation_attempts, audit_log).
 *
 * Auth: caller's JWT in `Authorization: Bearer ...`. RLS enforces that
 * non-owned rows are simply invisible — we never touch a service-role key
 * here.
 *
 * Audio policy reminder (printed inline in the payload as a `_note`): audio
 * data has NEVER been collected. `pronunciation_attempts.recognized_text`
 * stores the recognized word/phrase only — no free-form child speech.
 */

import { createClient } from 'supabase';

const LOCAL_DEV_ORIGINS = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

function resolveAllowedOrigin(requestOrigin: string | null): string | null {
  const configured = Deno.env.get('ALLOWED_ORIGIN');
  if (requestOrigin && LOCAL_DEV_ORIGINS.has(requestOrigin)) return requestOrigin;
  if (requestOrigin && configured && requestOrigin === configured) return requestOrigin;
  return null;
}

function corsHeaders(allowed: string | null): Record<string, string> {
  if (!allowed) return {};
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Vary': 'Origin',
  };
}

function isoDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  const requestOrigin = req.headers.get('origin');
  const allowed = resolveAllowedOrigin(requestOrigin);
  const cors = corsHeaders(allowed);

  if (req.method === 'OPTIONS') {
    if (!allowed) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'method-not-allowed' }), {
      status: 405,
      headers: { ...cors, 'content-type': 'application/json' },
    });
  }

  if (!allowed) {
    return new Response(JSON.stringify({ error: 'origin-not-allowed' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'missing-jwt' }), {
      status: 401,
      headers: { ...cors, 'content-type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    return new Response(JSON.stringify({ error: 'server-misconfigured' }), {
      status: 500,
      headers: { ...cors, 'content-type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: 'invalid-jwt' }), {
      status: 401,
      headers: { ...cors, 'content-type': 'application/json' },
    });
  }
  const callerId = userData.user.id;

  // Profile — RLS guarantees we only get our own row.
  const profileRes = await supabase
    .from('profiles')
    .select('*')
    .eq('id', callerId)
    .maybeSingle();

  if (profileRes.error) {
    return new Response(
      JSON.stringify({ error: 'profile-fetch-failed', detail: profileRes.error.message }),
      { status: 500, headers: { ...cors, 'content-type': 'application/json' } },
    );
  }

  // Children — RLS limits to children owned by the caller.
  const childrenRes = await supabase.from('children').select('*');
  if (childrenRes.error) {
    return new Response(
      JSON.stringify({ error: 'children-fetch-failed', detail: childrenRes.error.message }),
      { status: 500, headers: { ...cors, 'content-type': 'application/json' } },
    );
  }

  const children = childrenRes.data ?? [];
  const childIds = children.map((c: { id: string }) => c.id);

  // Per-child dependent rows — parallel queries, each scoped by RLS.
  type Row = Record<string, unknown>;
  const fetchScoped = async (
    table: 'progress' | 'vocab_state' | 'pronunciation_attempts' | 'audit_log',
  ): Promise<Row[]> => {
    if (childIds.length === 0) return [];
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .in('child_id', childIds);
    if (error) throw new Error(`${table}: ${error.message}`);
    return (data ?? []) as Row[];
  };

  let progress: Row[];
  let vocab: Row[];
  let pron: Row[];
  let audit: Row[];
  try {
    [progress, vocab, pron, audit] = await Promise.all([
      fetchScoped('progress'),
      fetchScoped('vocab_state'),
      fetchScoped('pronunciation_attempts'),
      fetchScoped('audit_log'),
    ]);
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: 'dependent-fetch-failed',
        detail: err instanceof Error ? err.message : 'unknown',
      }),
      { status: 500, headers: { ...cors, 'content-type': 'application/json' } },
    );
  }

  const byChild = (rows: Row[], cid: string): Row[] =>
    rows.filter((r) => r.child_id === cid);

  const payload = {
    exportedAt: new Date().toISOString(),
    schemaVersion: '1.0.0' as const,
    _note:
      'Audio data has never been collected. Pronunciation_attempts contain ' +
      'numeric scores and the recognized word only — no free-form speech.',
    parent: profileRes.data,
    children: children.map((c: { id: string }) => ({
      profile: c,
      progress: byChild(progress, c.id),
      vocabState: byChild(vocab, c.id),
      pronunciationAttempts: byChild(pron, c.id),
      auditLog: byChild(audit, c.id),
    })),
  };

  const filename = `english4kids-export-${isoDate()}.json`;
  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      ...cors,
      'content-type': 'application/json',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
});
