import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { serverEnv } from '@/lib/env';

/** Bypasses RLS. Server-only; every query must filter by the authenticated user's id. */
export function createAdminClient() {
  const env = serverEnv();
  return createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
