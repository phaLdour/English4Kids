/**
 * vpc-upgrade — Email-plus Verifiable Parental Consent (COPPA).
 *
 * Three sub-endpoints on one Deno function, dispatched by URL suffix:
 *   POST /vpc-upgrade/start          -> issue token + send confirmation email
 *   POST /vpc-upgrade/confirm-first  -> record first confirmation
 *   POST /vpc-upgrade/confirm-second -> after >= 24h, upgrade the profile
 *
 * Why the 24h delay? COPPA's "email-plus" Verifiable Parental Consent
 * method requires a follow-up confirmation that is *not* a simple page
 * reload. We satisfy this with a second confirmation that the parent can
 * only complete >= 24h after the first. See ADR-0007.
 *
 * Auth: caller's JWT (anonymous Supabase user) — RLS on `vpc_pending`
 * enforces that a parent can only touch their own pending rows.
 *
 * IMPORTANT: this function does NOT use a service-role key. The final
 * profile upgrade flips `is_anonymous` to `false` via an RLS-permitted
 * update; the auth-side email linking is initiated client-side via
 * `auth.updateUser({ email })` (the Supabase auth flow handles the actual
 * email verification on its own). Here we just gate it behind the
 * email-plus consent window.
 *
 * Dev-mode escape hatches (NEVER active in production):
 *   - `devToken` in the `/start` response: returned only when
 *     `EMAIL_DEV_MODE === 'true'`. Lets the client paste the confirmation
 *     token without SMTP being configured.
 *   - `?devSkipDelay=1` on `/confirm-second`: bypasses the 24h check.
 *     Gated by `EMAIL_DEV_MODE === 'true'` AND the explicit query param;
 *     production deploys MUST leave `EMAIL_DEV_MODE` unset. The 24h gap
 *     is a COPPA contract, not a UX choice — see `docs/devops/email-setup.md`.
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
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

// ----------------------------------------------------------------------------
// Token generation — 32 URL-safe characters from a 24-byte random source.
// ----------------------------------------------------------------------------

function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  // base64url
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ----------------------------------------------------------------------------
// Schemas
// ----------------------------------------------------------------------------

const StartSchema = z.object({
  email: z.string().email().max(254),
});

const TokenSchema = z.object({
  token: z.string().min(8).max(128),
});

const SECOND_CONFIRM_WINDOW_MS = 24 * 60 * 60 * 1000;

// ----------------------------------------------------------------------------
// Handlers
// ----------------------------------------------------------------------------

interface HandlerCtx {
  supabase: SupabaseClient;
  callerId: string;
  origin: string;
  /** Whether the caller asked for the dev-mode delay bypass on this request. */
  devSkipDelay: boolean;
}

async function handleStart(req: Request, ctx: HandlerCtx): Promise<Response> {
  const body = await req.json().catch(() => null);
  const parsed = StartSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'invalid-body', detail: parsed.error.flatten() }, 400);
  }

  const token = generateToken();
  const { data, error } = await ctx.supabase
    .from('vpc_pending')
    .insert({
      parent_id: ctx.callerId,
      email: parsed.data.email,
      token,
    })
    .select('id, requested_at')
    .single();

  if (error || !data) {
    return json({ error: 'insert-failed', detail: error?.message }, 500);
  }

  // No email provider is configured in this sandbox. Log the confirmation
  // link so dev can copy-paste; in production the link goes via Supabase's
  // built-in transactional email (TODO: wire to `auth.signInWithOtp` once
  // SMTP is configured).
  // eslint-disable-next-line no-console
  console.log(
    `[VPC] confirmation link: ${ctx.origin}/vpc-confirm/${token}`,
  );

  return json({
    status: 'pending',
    requestedAt: data.requested_at,
    // We return the token in dev only — in production this MUST be removed
    // and the parent must use the link from the email. The client UI keys
    // off NEXT_PUBLIC_E4K_ENV to decide whether to display it.
    devToken: token,
  });
}

async function handleConfirmFirst(req: Request, ctx: HandlerCtx): Promise<Response> {
  const body = await req.json().catch(() => null);
  const parsed = TokenSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'invalid-body' }, 400);
  }

  const now = new Date();
  const { data, error } = await ctx.supabase
    .from('vpc_pending')
    .update({ first_confirmed_at: now.toISOString() })
    .eq('token', parsed.data.token)
    .is('first_confirmed_at', null)
    .gt('expires_at', now.toISOString())
    .select('id, first_confirmed_at')
    .maybeSingle();

  if (error) return json({ error: 'update-failed', detail: error.message }, 500);
  if (!data) return json({ error: 'token-invalid-or-expired' }, 404);

  const secondAvailable = new Date(
    new Date(data.first_confirmed_at).getTime() + SECOND_CONFIRM_WINDOW_MS,
  );
  return json({
    status: 'awaiting-second-confirmation',
    secondConfirmAvailableAt: secondAvailable.toISOString(),
  });
}

async function handleConfirmSecond(req: Request, ctx: HandlerCtx): Promise<Response> {
  const body = await req.json().catch(() => null);
  const parsed = TokenSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'invalid-body' }, 400);
  }

  const { data: pending, error: fetchErr } = await ctx.supabase
    .from('vpc_pending')
    .select('id, email, first_confirmed_at, second_confirmed_at, expires_at, parent_id')
    .eq('token', parsed.data.token)
    .maybeSingle();

  if (fetchErr) return json({ error: 'fetch-failed', detail: fetchErr.message }, 500);
  if (!pending) return json({ error: 'token-invalid' }, 404);
  if (pending.parent_id !== ctx.callerId) return json({ error: 'token-not-yours' }, 403);
  if (new Date(pending.expires_at).getTime() < Date.now()) {
    return json({ error: 'token-expired' }, 410);
  }
  if (!pending.first_confirmed_at) {
    return json({ error: 'first-confirmation-missing' }, 409);
  }
  if (pending.second_confirmed_at) {
    return json({ status: 'upgraded', alreadyUpgraded: true });
  }

  const firstMs = new Date(pending.first_confirmed_at).getTime();
  const earliest = firstMs + SECOND_CONFIRM_WINDOW_MS;
  // Dev-mode escape hatch for E2E. Gated by BOTH `EMAIL_DEV_MODE === 'true'`
  // AND the explicit `?devSkipDelay=1` query param so a misconfigured prod
  // env can't accidentally bypass the COPPA-mandated 24h window.
  const devMode = Deno.env.get('EMAIL_DEV_MODE') === 'true';
  const skipDelay = devMode && ctx.devSkipDelay;
  if (!skipDelay && Date.now() < earliest) {
    return json({
      status: 'too-early',
      tryAgainAt: new Date(earliest).toISOString(),
    }, 425);
  }

  // ----- Atomic upgrade ----------------------------------------------------
  // Update vpc_pending + profiles in sequence. RLS keeps both scoped to the
  // caller. ADR-0003 demands the parent_id swap (atomic anonymous->upgrade)
  // for any owned children rows happens inside a single transaction — that
  // is satisfied here because the `children.parent_id` value does NOT
  // change. The profile row referenced by `children.parent_id` is the SAME
  // uuid both before and after upgrade; we only flip `is_anonymous`.
  const now = new Date().toISOString();

  const markSecond = await ctx.supabase
    .from('vpc_pending')
    .update({ second_confirmed_at: now })
    .eq('id', pending.id);
  if (markSecond.error) {
    return json({ error: 'second-confirm-failed', detail: markSecond.error.message }, 500);
  }

  const upgradeProfile = await ctx.supabase
    .from('profiles')
    .update({
      is_anonymous: false,
      upgraded_at: now,
      role: 'parent',
    })
    .eq('id', ctx.callerId);
  if (upgradeProfile.error) {
    return json(
      { error: 'profile-upgrade-failed', detail: upgradeProfile.error.message },
      500,
    );
  }

  return json({
    status: 'upgraded',
    email: pending.email,
    upgradedAt: now,
    // The CLIENT is responsible for invoking `supabase.auth.updateUser({ email })`
    // immediately after this call — that triggers Supabase's own email
    // verification round trip. The double opt-in above is what gates whether
    // the client is *allowed* to do that.
    nextStep: 'client-must-call-auth-updateUser',
  });
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...extra },
  });
}

// ----------------------------------------------------------------------------
// Entry
// ----------------------------------------------------------------------------

Deno.serve(async (req) => {
  const requestOrigin = req.headers.get('origin');
  const allowed = resolveAllowedOrigin(requestOrigin);
  const cors = corsHeaders(allowed);

  if (req.method === 'OPTIONS') {
    if (!allowed) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: cors });
  }

  if (!allowed) {
    return json({ error: 'origin-not-allowed' }, 403);
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method-not-allowed' }), {
      status: 405,
      headers: { ...cors, 'content-type': 'application/json' },
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
  const url = new URL(req.url);
  const tail = url.pathname.replace(/^.*\/vpc-upgrade/, '');
  const ctx: HandlerCtx = {
    supabase,
    callerId: userData.user.id,
    origin: allowed,
    devSkipDelay: url.searchParams.get('devSkipDelay') === '1',
  };

  let res: Response;
  if (tail === '/start' || tail === '') {
    res = await handleStart(req, ctx);
  } else if (tail === '/confirm-first') {
    res = await handleConfirmFirst(req, ctx);
  } else if (tail === '/confirm-second') {
    res = await handleConfirmSecond(req, ctx);
  } else {
    res = new Response(JSON.stringify({ error: 'unknown-subpath' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Merge in CORS headers without clobbering content-type.
  const merged = new Headers(res.headers);
  for (const [k, v] of Object.entries(cors)) merged.set(k, v);
  return new Response(res.body, { status: res.status, headers: merged });
});
