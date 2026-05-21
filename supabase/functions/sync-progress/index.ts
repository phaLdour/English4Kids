/**
 * sync-progress — Deno-runtime Supabase Edge Function.
 *
 * Receives a batch of sync ops from the client's local `sync_outbox` table
 * (Dexie mirror), applies them server-side under RLS using the caller's JWT,
 * and returns per-op results.
 *
 * Hard safety contracts (Safety Officer red lines):
 *   1. No audio Blob ever crosses this boundary. `pronunciation.record`
 *      payloads are rejected outright if they contain anything that smells
 *      like base64 audio or an `audioData` key.
 *   2. We use the CALLER'S JWT — never a service-role key. RLS does the
 *      authorization.
 *   3. Every op is idempotent via `client_op_id`. Duplicate submissions
 *      (e.g. retried after flaky network) are reported as `'duplicate'`,
 *      not re-applied.
 *   4. Conflict resolution per ADR-0003 / ADR-0004:
 *        - progress.upsert  -> `max(stars)` wins (gameplay monotonicity).
 *        - vocab.advance    -> higher Leitner box wins.
 *        - pronunciation    -> insert-only, no conflict possible.
 *        - audit.append     -> insert-only.
 *
 * Partial failures: each op is wrapped in its own try/catch — one bad op
 * does NOT abort the rest of the batch.
 */

import { createClient, type SupabaseClient } from 'supabase';
import { z } from 'zod';

// ----------------------------------------------------------------------------
// Request schema
// ----------------------------------------------------------------------------

const OpTypeSchema = z.enum([
  'progress.upsert',
  'vocab.advance',
  'pronunciation.record',
  'audit.append',
]);

const OpSchema = z.object({
  clientOpId: z.string().min(1).max(128),
  opType: OpTypeSchema,
  payload: z.record(z.unknown()),
});

const RequestSchema = z.object({
  childId: z.string().uuid(),
  ops: z.array(OpSchema).min(1).max(100),
});

type OpType = z.infer<typeof OpTypeSchema>;
type Op = z.infer<typeof OpSchema>;

interface OpResult {
  clientOpId: string;
  status: 'applied' | 'duplicate' | 'rejected';
  reason?: string;
}

// ----------------------------------------------------------------------------
// CORS
// ----------------------------------------------------------------------------

const LOCAL_DEV_ORIGINS = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

function resolveAllowedOrigin(requestOrigin: string | null): string | null {
  const configured = Deno.env.get('ALLOWED_ORIGIN');
  if (requestOrigin && LOCAL_DEV_ORIGINS.has(requestOrigin)) {
    return requestOrigin;
  }
  if (requestOrigin && configured && requestOrigin === configured) {
    return requestOrigin;
  }
  return null;
}

function corsHeaders(allowed: string | null): Record<string, string> {
  if (!allowed) return {};
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

// ----------------------------------------------------------------------------
// Audio-blob heuristic — reject any payload that looks like raw audio.
// Defence in depth: the client should never send audio in the first place.
// ----------------------------------------------------------------------------

const BASE64_AUDIO_RE = /^data:audio\//i;
const SUSPICIOUS_KEYS = new Set([
  'audio',
  'audioData',
  'audio_data',
  'audioBlob',
  'audio_blob',
  'rawAudio',
  'raw_audio',
  'pcm',
  'waveform',
]);

function containsAudioBlob(value: unknown, depth = 0): boolean {
  if (depth > 4) return false;
  if (typeof value === 'string') {
    if (BASE64_AUDIO_RE.test(value)) return true;
    // Very long base64-looking string -> reject conservatively.
    if (value.length > 4096 && /^[A-Za-z0-9+/=\s]+$/.test(value)) return true;
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((v) => containsAudioBlob(v, depth + 1));
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SUSPICIOUS_KEYS.has(k)) return true;
      if (containsAudioBlob(v, depth + 1)) return true;
    }
  }
  return false;
}

// ----------------------------------------------------------------------------
// Per-op handlers. Each returns the new op status; throws on hard errors.
// ----------------------------------------------------------------------------

interface ApplyContext {
  supabase: SupabaseClient;
  childId: string;
  callerId: string;
}

async function applyProgressUpsert(
  ctx: ApplyContext,
  payload: Record<string, unknown>,
): Promise<void> {
  const ProgressSchema = z.object({
    lesson_id: z.string().min(1).max(64),
    status: z.enum(['locked', 'in_progress', 'completed', 'mastered']).optional(),
    stars: z.number().int().min(0).max(3).optional(),
    best_score: z.number().min(0).max(100).optional(),
    attempts_count: z.number().int().min(0).optional(),
    last_attempt_at: z.string().optional(),
  });
  const parsed = ProgressSchema.parse(payload);

  // Read existing row to enforce monotonic stars/best_score.
  const existing = await ctx.supabase
    .from('progress')
    .select('id, stars, best_score, attempts_count')
    .eq('child_id', ctx.childId)
    .eq('lesson_id', parsed.lesson_id)
    .maybeSingle();

  const existingStars = (existing.data?.stars as number | null | undefined) ?? 0;
  const existingBest = (existing.data?.best_score as number | null | undefined) ?? 0;
  const existingAttempts =
    (existing.data?.attempts_count as number | null | undefined) ?? 0;

  const mergedStars = Math.max(existingStars, parsed.stars ?? existingStars);
  const mergedBest = Math.max(existingBest, parsed.best_score ?? existingBest);
  const mergedAttempts = Math.max(
    existingAttempts,
    parsed.attempts_count ?? existingAttempts,
  );

  const { error } = await ctx.supabase
    .from('progress')
    .upsert(
      {
        child_id: ctx.childId,
        lesson_id: parsed.lesson_id,
        status: parsed.status ?? 'in_progress',
        stars: mergedStars,
        best_score: mergedBest,
        attempts_count: mergedAttempts,
        last_attempt_at: parsed.last_attempt_at ?? new Date().toISOString(),
      },
      { onConflict: 'child_id,lesson_id' },
    );
  if (error) throw new Error(error.message);
}

async function applyVocabAdvance(
  ctx: ApplyContext,
  payload: Record<string, unknown>,
): Promise<void> {
  const VocabSchema = z.object({
    word_key: z.string().min(1).max(64),
    box: z.number().int().min(1).max(5),
    consecutive_correct: z.number().int().min(0).optional(),
    last_result: z.enum(['correct', 'incorrect']).optional(),
    last_seen_at: z.string().optional(),
    due_at: z.string(),
  });
  const parsed = VocabSchema.parse(payload);

  const existing = await ctx.supabase
    .from('vocab_state')
    .select('id, box')
    .eq('child_id', ctx.childId)
    .eq('word_key', parsed.word_key)
    .maybeSingle();

  // Monotonic-union conflict rule (ADR-0004): higher box wins.
  const existingBox = (existing.data?.box as number | null | undefined) ?? 1;
  const mergedBox = Math.max(existingBox, parsed.box);

  const { error } = await ctx.supabase
    .from('vocab_state')
    .upsert(
      {
        child_id: ctx.childId,
        word_key: parsed.word_key,
        box: mergedBox,
        consecutive_correct: parsed.consecutive_correct ?? 0,
        last_result: parsed.last_result ?? null,
        last_seen_at: parsed.last_seen_at ?? new Date().toISOString(),
        due_at: parsed.due_at,
      },
      { onConflict: 'child_id,word_key' },
    );
  if (error) throw new Error(error.message);
}

async function applyPronunciationRecord(
  ctx: ApplyContext,
  payload: Record<string, unknown>,
): Promise<void> {
  if (containsAudioBlob(payload)) {
    throw new Error('audio-blob-rejected');
  }
  const PronSchema = z.object({
    word_key: z.string().min(1).max(64),
    score: z.number().min(0).max(100),
    band: z.enum(['great', 'good', 'try-again']),
    recognized_text: z.string().max(64).nullable().optional(),
    engine: z.enum(['web-speech', 'whisper-wasm']),
    attempted_at: z.string().optional(),
  });
  const parsed = PronSchema.parse(payload);

  const { error } = await ctx.supabase.from('pronunciation_attempts').insert({
    child_id: ctx.childId,
    word_key: parsed.word_key,
    score: parsed.score,
    band: parsed.band,
    recognized_text: parsed.recognized_text ?? null,
    engine: parsed.engine,
    attempted_at: parsed.attempted_at ?? new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

async function applyAuditAppend(
  ctx: ApplyContext,
  payload: Record<string, unknown>,
): Promise<void> {
  const AuditSchema = z.object({
    event_type: z.string().min(1).max(64),
    payload: z.record(z.unknown()).optional(),
    occurred_at: z.string().optional(),
  });
  const parsed = AuditSchema.parse(payload);

  const { error } = await ctx.supabase.from('audit_log').insert({
    actor_id: ctx.callerId,
    child_id: ctx.childId,
    event_type: parsed.event_type,
    payload: parsed.payload ?? {},
    occurred_at: parsed.occurred_at ?? new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

const HANDLERS: Record<
  OpType,
  (ctx: ApplyContext, payload: Record<string, unknown>) => Promise<void>
> = {
  'progress.upsert': applyProgressUpsert,
  'vocab.advance': applyVocabAdvance,
  'pronunciation.record': applyPronunciationRecord,
  'audit.append': applyAuditAppend,
};

// ----------------------------------------------------------------------------
// Outbox helpers
// ----------------------------------------------------------------------------

async function isAlreadyApplied(
  supabase: SupabaseClient,
  clientOpId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('sync_outbox')
    .select('id, applied_at')
    .eq('client_op_id', clientOpId)
    .maybeSingle();
  if (error) {
    // RLS may legitimately hide the row — treat as "not applied" and let the
    // unique constraint fire on insert if it really is a dup.
    return false;
  }
  return data?.applied_at != null;
}

async function markOpApplied(
  supabase: SupabaseClient,
  childId: string,
  op: Op,
): Promise<void> {
  // Upsert by client_op_id so a partially-recorded outbox row is healed.
  const { error } = await supabase.from('sync_outbox').upsert(
    {
      child_id: childId,
      client_op_id: op.clientOpId,
      op_type: op.opType,
      op_payload: op.payload,
      applied_at: new Date().toISOString(),
    },
    { onConflict: 'client_op_id' },
  );
  if (error) {
    // Don't throw — the data table write already succeeded; log only.
    console.warn('[sync-progress] outbox-mark-failed', op.clientOpId, error.message);
  }
}

// ----------------------------------------------------------------------------
// Handler
// ----------------------------------------------------------------------------

Deno.serve(async (req) => {
  const requestOrigin = req.headers.get('origin');
  const allowed = resolveAllowedOrigin(requestOrigin);
  const cors = corsHeaders(allowed);

  if (req.method === 'OPTIONS') {
    if (!allowed) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== 'POST') {
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

  // ---- Auth ----------------------------------------------------------------
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

  // The caller's JWT becomes the auth context — RLS enforces ownership.
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

  // ---- Sprint 5 S5-3: server-side anonymous-first gate ---------------------
  // Defence-in-edge layer (#2 of 3). Layer #1 is the client `useAutoSync`
  // gate; layer #3 is the DB trigger in 0005_anonymous_sync_gate.sql. Any
  // one of them on its own is sufficient to block anonymous syncs — we run
  // all three because the client gate is bypassable by a tampered build,
  // the DB trigger fires too late to return a useful error to the client,
  // and only this layer returns a 403 that the client can surface as a
  // "verify your email" banner.
  const { data: parentProfile, error: parentErr } = await supabase
    .from('profiles')
    .select('is_anonymous')
    .eq('id', callerId)
    .single();
  if (parentErr || !parentProfile || parentProfile.is_anonymous !== false) {
    return new Response(
      JSON.stringify({
        error: 'anonymous-first',
        message:
          "Cloud sync isn't active yet. Verify your email in the parent dashboard to enable it.",
      }),
      {
        status: 403,
        headers: { ...cors, 'content-type': 'application/json' },
      },
    );
  }

  // ---- Body ----------------------------------------------------------------
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid-json' }), {
      status: 400,
      headers: { ...cors, 'content-type': 'application/json' },
    });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'invalid-body', detail: parsed.error.flatten() }),
      {
        status: 400,
        headers: { ...cors, 'content-type': 'application/json' },
      },
    );
  }
  const { childId, ops } = parsed.data;

  // ---- Ownership check (RLS-friendly) -------------------------------------
  const ownership = await supabase
    .from('children')
    .select('id')
    .eq('id', childId)
    .maybeSingle();
  if (ownership.error || !ownership.data) {
    return new Response(JSON.stringify({ error: 'child-not-owned' }), {
      status: 403,
      headers: { ...cors, 'content-type': 'application/json' },
    });
  }

  // ---- Apply ops -----------------------------------------------------------
  const ctx: ApplyContext = { supabase, childId, callerId };
  const results: OpResult[] = [];

  for (const op of ops) {
    try {
      if (await isAlreadyApplied(supabase, op.clientOpId)) {
        results.push({ clientOpId: op.clientOpId, status: 'duplicate' });
        continue;
      }
      const handler = HANDLERS[op.opType];
      if (!handler) {
        results.push({
          clientOpId: op.clientOpId,
          status: 'rejected',
          reason: 'unknown-op-type',
        });
        continue;
      }
      await handler(ctx, op.payload);
      await markOpApplied(supabase, childId, op);
      results.push({ clientOpId: op.clientOpId, status: 'applied' });
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unknown-error';
      results.push({ clientOpId: op.clientOpId, status: 'rejected', reason });
    }
  }

  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { ...cors, 'content-type': 'application/json' },
  });
});
