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
import { renderEmailTemplate } from '../_shared/email-templates.ts';

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

// ----------------------------------------------------------------------------
// Sprint 5 S5-4: rate limiter for /start.
//
// Policy: max 5 calls per parent_id per rolling 60-minute window. Above that,
// return 429 with a `retry-after` header. The cap exists so a confused parent
// or a malicious anonymous user cannot turn our Resend account into an open
// spam relay against arbitrary inboxes (or, separately, blow through the
// free tier in a few minutes).
//
// The window is per parent_id (Supabase anonymous-uid), not per IP — Edge
// Functions don't get a stable client IP, and even if they did, NAT'd
// classrooms would all share one. Per-uid is the right granularity.
//
// Returns:
//   - { allowed: true } if the caller is within budget (count was bumped).
//   - { allowed: false, retryAfterSec } if they're out of budget.
// ----------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_CALLS = 5;

async function checkAndBumpRateLimit(
  supabase: SupabaseClient,
  parentId: string,
): Promise<{ allowed: true } | { allowed: false; retryAfterSec: number }> {
  const now = Date.now();
  const { data: existing } = await supabase
    .from('vpc_rate_limit')
    .select('start_count, window_start')
    .eq('parent_id', parentId)
    .maybeSingle();

  if (!existing) {
    // First-ever call from this parent — seed the row with count=1.
    const { error: insertErr } = await supabase
      .from('vpc_rate_limit')
      .insert({ parent_id: parentId, start_count: 1, window_start: new Date(now).toISOString() });
    if (insertErr) {
      // If the seed insert raced with another worker, the upsert below will
      // pick it up on the next call. Treat as allowed to avoid false-429s.
      return { allowed: true };
    }
    return { allowed: true };
  }

  const windowStartMs = new Date(existing.window_start as string).getTime();
  const windowAgeMs = now - windowStartMs;

  if (windowAgeMs >= RATE_LIMIT_WINDOW_MS) {
    // Window expired — reset to a fresh window with count=1.
    await supabase
      .from('vpc_rate_limit')
      .update({ start_count: 1, window_start: new Date(now).toISOString() })
      .eq('parent_id', parentId);
    return { allowed: true };
  }

  const currentCount = (existing.start_count as number) ?? 0;
  if (currentCount >= RATE_LIMIT_MAX_CALLS) {
    const retryAfterSec = Math.ceil(
      (windowStartMs + RATE_LIMIT_WINDOW_MS - now) / 1000,
    );
    return { allowed: false, retryAfterSec: Math.max(retryAfterSec, 1) };
  }

  await supabase
    .from('vpc_rate_limit')
    .update({ start_count: currentCount + 1 })
    .eq('parent_id', parentId);
  return { allowed: true };
}

// ----------------------------------------------------------------------------
// Sprint 5 S5-4: Resend send-or-fall-back-to-dev.
//
// Two paths share this function so /start and the (future) reminder cron
// both render through the same template gate:
//   - Production: `RESEND_API_KEY` is set and `EMAIL_DEV_MODE !== 'true'`.
//     We POST to Resend's REST endpoint and surface a typed result.
//   - Dev: missing key OR `EMAIL_DEV_MODE === 'true'`. We log the rendered
//     subject + a confirmation link and return `{ delivered: 'dev-log' }`
//     so the caller can decide whether to expose the token to the client
//     for copy-paste.
// ----------------------------------------------------------------------------

type EmailDeliveryResult =
  | { delivered: 'resend'; id?: string }
  | { delivered: 'dev-log' }
  | { delivered: 'error'; status: number; detail: string };

async function sendEmail(
  to: string,
  rendered: { subject: string; html: string; text: string },
): Promise<EmailDeliveryResult> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const emailFrom = Deno.env.get('EMAIL_FROM') ?? 'noreply@english4kids.app';
  const emailDevMode = Deno.env.get('EMAIL_DEV_MODE') === 'true';

  if (!resendApiKey || emailDevMode) {
    // Dev fallback — log the subject so engineers tailing the function
    // can confirm a send was triggered without exposing the body.
    console.log(`[VPC dev-mode email] to=${to} subject=${rendered.subject}`);
    return { delivered: 'dev-log' };
  }

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailFrom,
        to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      }),
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      console.error('[VPC] Resend send failed', resp.status, detail);
      return { delivered: 'error', status: resp.status, detail };
    }
    const parsed = await resp.json().catch(() => ({}));
    return { delivered: 'resend', id: (parsed as { id?: string }).id };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[VPC] Resend network error', detail);
    return { delivered: 'error', status: 0, detail };
  }
}

async function handleStart(req: Request, ctx: HandlerCtx): Promise<Response> {
  const body = await req.json().catch(() => null);
  const parsed = StartSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'invalid-body', detail: parsed.error.flatten() }, 400);
  }

  // Sprint 5 S5-4: rate-limit BEFORE generating a token or writing a pending
  // row. If we let an attacker burn through tokens we also burn through
  // their unique constraint and the audit-log noise.
  const rate = await checkAndBumpRateLimit(ctx.supabase, ctx.callerId);
  if (!rate.allowed) {
    return json(
      {
        error: 'rate-limited',
        retryAfterSec: rate.retryAfterSec,
        message:
          'Too many confirmation requests recently. Please wait an hour before trying again.',
      },
      429,
      { 'retry-after': String(rate.retryAfterSec) },
    );
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

  // Render the email and try to send it. The confirmation link points at
  // the web origin (not the function origin) — the page at
  // `/vpc-confirm/[token]` is where the parent lands.
  const confirmLink = `${ctx.origin}/vpc-confirm/${token}`;
  // Look up the parent's display_name for a friendlier greeting; RLS lets
  // the caller read their own row. Anonymous profiles often have no name,
  // so a fallback is essential.
  const { data: profile } = await ctx.supabase
    .from('profiles')
    .select('display_name')
    .eq('id', ctx.callerId)
    .maybeSingle();
  const rendered = renderEmailTemplate('vpc-first-confirmation', {
    confirmLink,
    parentNickname: profile?.display_name ?? undefined,
  });

  const delivery = await sendEmail(parsed.data.email, rendered);
  // Keep dev-mode behaviour intact: log the link for `supabase functions
  // serve` tailing, the same way the Sprint 4 implementation did.
  console.log(`[VPC] confirmation link: ${confirmLink}`);

  if (delivery.delivered === 'error') {
    // Surface a generic message to the client — never the Resend body, which
    // can include account-level metadata or rate-limit specifics.
    return json(
      {
        error: 'email-send-failed',
        message:
          "We couldn't send the confirmation email. Please try again in a few minutes.",
      },
      502,
    );
  }

  const emailDevMode = Deno.env.get('EMAIL_DEV_MODE') === 'true';
  return json({
    status: 'awaiting-first-confirmation',
    email: parsed.data.email,
    requestedAt: data.requested_at,
    delivered: delivery.delivered,
    // devToken is returned ONLY when EMAIL_DEV_MODE === 'true'. Production
    // deploys must leave that env var unset; the client UI also gates on
    // NEXT_PUBLIC_E4K_ENV !== 'production' before reading the value.
    ...(emailDevMode ? { devToken: token } : {}),
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

  // Best-effort welcome email after the upgrade. A delivery failure here
  // must NOT block the upgrade response — the profile flip already
  // succeeded and the client still needs to drive `auth.updateUser`. We
  // log + continue. The Supabase-side verification email is the source of
  // truth for "did this email actually reach the parent?"; this one is a
  // courtesy.
  try {
    const { data: profile } = await ctx.supabase
      .from('profiles')
      .select('display_name')
      .eq('id', ctx.callerId)
      .maybeSingle();
    const rendered = renderEmailTemplate('vpc-upgrade-complete', {
      parentNickname: profile?.display_name ?? undefined,
      verifiedEmail: pending.email,
    });
    await sendEmail(pending.email, rendered);
  } catch (err) {
    console.warn('[VPC] welcome email failed (non-fatal)', err);
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
