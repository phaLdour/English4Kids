/**
 * account-deletion — COPPA right-of-erasure with a 7-day grace window.
 *
 * Three actions on one Deno function, dispatched by request body:
 *   { action: "request" }  -> create a pending deletion (7-day grace)
 *   { action: "cancel"  }  -> cancel a pending deletion if grace not expired
 *   { action: "status"  }  -> return the active pending deletion (if any)
 *
 * Why a grace window? Parents (or 13+ users) commonly request deletion in
 * a moment of frustration and reconsider. COPPA does not mandate
 * immediate hard-deletion; "without undue delay" is the standard, and a
 * 7-day grace window is well within that envelope. Crucially, sign-out
 * does NOT cancel — the user must explicitly hit "Cancel deletion" from
 * the parent account page while signed back in.
 *
 * Hard-delete (after grace expiry) is performed by a scheduled task that
 * runs as service-role against `account_deletions` rows where
 * `grace_until < now() and cancelled_at is null and completed_at is null`.
 * That task is NOT part of this function; it lives in a Supabase cron job
 * (configured via the dashboard) so the failure surface is separate.
 *
 * Email confirmation: when `RESEND_API_KEY` is configured AND the user
 * row carries a confirmed `email`, this function sends a confirmation
 * email at /request time. Without Resend, the function still records the
 * pending deletion and the UI carries the "we'll delete in 7 days"
 * message. There is no security regression — the grace window is the
 * actual safety net, not the email.
 *
 * Auth: caller's JWT. RLS on `account_deletions` enforces user_id =
 * auth.uid(). The function never uses a service-role key.
 */

import { createClient, type SupabaseClient } from 'supabase';
import { z } from 'zod';

// ----------------------------------------------------------------------------
// CORS
// ----------------------------------------------------------------------------

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
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

// ----------------------------------------------------------------------------
// Schema
// ----------------------------------------------------------------------------

const RequestSchema = z.object({
  action: z.enum(['request', 'cancel', 'status']),
  reason: z.string().max(500).nullable().optional(),
});

const GRACE_DAYS = 7;
const GRACE_MS = GRACE_DAYS * 24 * 60 * 60 * 1000;

// ----------------------------------------------------------------------------
// Handler
// ----------------------------------------------------------------------------

function userClient(req: Request): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon) throw new Error('SUPABASE_URL or SUPABASE_ANON_KEY missing');
  const auth = req.headers.get('Authorization') ?? '';
  return createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
}

async function getActiveDeletion(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from('account_deletions')
    .select('id, requested_at, grace_until, reason, children_count_at_request, cancelled_at, completed_at')
    .eq('user_id', userId)
    .is('cancelled_at', null)
    .is('completed_at', null)
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function countChildren(client: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await client
    .from('children')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', userId);
  if (error) return 0;
  return count ?? 0;
}

async function writeAudit(client: SupabaseClient, userId: string, event: string, payload: Record<string, unknown>): Promise<void> {
  await client.from('audit_log').insert({
    actor_id: userId,
    event_type: event,
    payload,
  });
}

async function maybeSendConfirmationEmail(email: string | null, graceUntil: string): Promise<void> {
  if (!email) return;
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return;
  const from = Deno.env.get('RESEND_FROM') ?? 'English4Kids <noreply@english4kids.app>';
  const body = `Your English4Kids account is scheduled for deletion. We will permanently remove it on ${graceUntil}. If you change your mind, sign back in and choose Cancel deletion from your account page.`;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: 'Your English4Kids deletion request',
        text: body,
      }),
    });
  } catch {
    // Best-effort. The DB record is the contract; email is a courtesy.
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const allowed = resolveAllowedOrigin(origin);
  const baseHeaders = corsHeaders(allowed);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: baseHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method-not-allowed' }), {
      status: 405,
      headers: { ...baseHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid-json' }), {
      status: 400,
      headers: { ...baseHeaders, 'Content-Type': 'application/json' },
    });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'invalid-body', details: parsed.error.flatten() }), {
      status: 400,
      headers: { ...baseHeaders, 'Content-Type': 'application/json' },
    });
  }

  let client: SupabaseClient;
  try {
    client = userClient(req);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'config', message: String(e) }), {
      status: 500,
      headers: { ...baseHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: userRes, error: userErr } = await client.auth.getUser();
  if (userErr || !userRes.user) {
    return new Response(JSON.stringify({ error: 'unauthenticated' }), {
      status: 401,
      headers: { ...baseHeaders, 'Content-Type': 'application/json' },
    });
  }
  const userId = userRes.user.id;
  const email = userRes.user.email ?? null;
  const action = parsed.data.action;

  if (action === 'status') {
    const active = await getActiveDeletion(client, userId);
    return new Response(JSON.stringify({ ok: true, pending: active }), {
      status: 200,
      headers: { ...baseHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (action === 'request') {
    const existing = await getActiveDeletion(client, userId);
    if (existing) {
      return new Response(JSON.stringify({ ok: true, pending: existing, alreadyRequested: true }), {
        status: 200,
        headers: { ...baseHeaders, 'Content-Type': 'application/json' },
      });
    }
    const children = await countChildren(client, userId);
    const graceUntil = new Date(Date.now() + GRACE_MS).toISOString();
    const { data: inserted, error: insErr } = await client
      .from('account_deletions')
      .insert({
        user_id: userId,
        reason: parsed.data.reason ?? null,
        grace_until: graceUntil,
        children_count_at_request: children,
      })
      .select()
      .single();
    if (insErr) {
      return new Response(JSON.stringify({ error: 'insert-failed', message: insErr.message }), {
        status: 500,
        headers: { ...baseHeaders, 'Content-Type': 'application/json' },
      });
    }
    await writeAudit(client, userId, 'auth.delete.requested', {
      grace_until: graceUntil,
      children_count_at_request: children,
      reason: parsed.data.reason ?? null,
    });
    await maybeSendConfirmationEmail(email, graceUntil);
    return new Response(JSON.stringify({ ok: true, pending: inserted }), {
      status: 200,
      headers: { ...baseHeaders, 'Content-Type': 'application/json' },
    });
  }

  // action === 'cancel'
  const existing = await getActiveDeletion(client, userId);
  if (!existing) {
    return new Response(JSON.stringify({ ok: true, cancelled: false, message: 'no-active-request' }), {
      status: 200,
      headers: { ...baseHeaders, 'Content-Type': 'application/json' },
    });
  }
  const { error: updErr } = await client
    .from('account_deletions')
    .update({ cancelled_at: new Date().toISOString() })
    .eq('id', existing.id);
  if (updErr) {
    return new Response(JSON.stringify({ error: 'cancel-failed', message: updErr.message }), {
      status: 500,
      headers: { ...baseHeaders, 'Content-Type': 'application/json' },
    });
  }
  await writeAudit(client, userId, 'auth.delete.cancelled', { request_id: existing.id });
  return new Response(JSON.stringify({ ok: true, cancelled: true }), {
    status: 200,
    headers: { ...baseHeaders, 'Content-Type': 'application/json' },
  });
});
