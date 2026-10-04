import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { publicEnv } from '@/lib/env';

const PROTECTED_PREFIXES = ['/dashboard', '/courses', '/study', '/placement', '/exam'];

/** Refreshes the auth session cookie on every request and gates protected routes. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  let cacheHeaders: Record<string, string> = {};
  const env = publicEnv();
  const supabase = createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // Cache-control headers that must accompany a cookie write, so a CDN or reverse
        // proxy in front of this app never caches (and replays) a response carrying
        // someone's session cookie. See @supabase/ssr's SetAllCookies type.
        cacheHeaders = headers;
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Do not run code between createServerClient and getClaims: it refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

  if (!signedIn && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    const redirectResponse = NextResponse.redirect(url);
    // A session refresh above may have rotated the auth cookies onto `response`; those
    // must still reach the browser even though we're sending a different response here.
    for (const cookie of response.cookies.getAll()) redirectResponse.cookies.set(cookie);
    for (const [key, value] of Object.entries(cacheHeaders)) redirectResponse.headers.set(key, value);
    return redirectResponse;
  }
  return response;
}
