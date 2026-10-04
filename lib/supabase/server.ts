import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { publicEnv } from '@/lib/env';

/**
 * Per-request client acting as the signed-in user (publishable key + auth cookies).
 *
 * `@supabase/ssr`'s `setAll` also receives a `headers` object: cache-control headers
 * that must ride on the same response as a cookie write, so a CDN or reverse proxy
 * never caches (and replays to a different visitor) a response carrying someone's
 * session cookie. `next/headers`' `cookies()` has no API to set response headers from
 * a Server Component or Server Action, so those callers (login, sign-out) cannot
 * forward them — that's a Next.js platform limit, not an oversight, and those routes
 * always end in `redirect()`, whose 3xx responses are not cached by default. A Route
 * Handler builds its own `Response` and can forward the headers, so `onHeaders` lets
 * `app/auth/callback/route.ts` do that.
 */
export async function createSessionClient(onHeaders?: (headers: Record<string, string>) => void) {
  const cookieStore = await cookies();
  const env = publicEnv();
  return createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet, headers) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
          onHeaders?.(headers);
        } catch {
          // Called from a Server Component, where cookies are read-only; proxy.ts refreshes the session.
        }
      },
    },
  });
}

/** Verified user id (JWT checked via getClaims), or null. */
export async function getUserId(): Promise<string | null> {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
}

export async function requireUserId(): Promise<string> {
  const userId = await getUserId();
  if (!userId) redirect('/login');
  return userId;
}
