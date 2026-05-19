/**
 * Singleton Supabase client.
 *
 * Reads env at first use to avoid crashing during SSR / build of the static
 * marketing pages that don't need DB access.
 */

import { type SupabaseClient, createClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase env not configured (NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY)');
  }
  cached = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return cached;
}

/** Reset the cached client. Test-only; safe no-op in production. */
export function __resetSupabaseClientForTests(): void {
  cached = null;
}
