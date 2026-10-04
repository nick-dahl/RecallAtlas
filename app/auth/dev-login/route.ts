import { NextResponse, type NextRequest } from 'next/server';
import { safeNext } from '@/lib/auth/safe-next';
import { devLoginEmail } from '@/lib/dev/dev-tools';
import { createAdminClient } from '@/lib/supabase/admin';
import { createSessionClient } from '@/lib/supabase/server';

/**
 * DEVELOPMENT ONLY: instant sign-in as DEV_LOGIN_EMAIL (no email sent, no rate limit).
 * Mints a magic-link token server-side with the secret key and verifies it into session cookies.
 * Returns 404 unless `next dev` is running and DEV_LOGIN_EMAIL is set.
 */
export async function GET(request: NextRequest) {
  const email = devLoginEmail();
  if (!email) return new NextResponse('Not found', { status: 404 });

  const { origin, searchParams } = request.nextUrl;
  const next = safeNext(searchParams.get('next'));
  const admin = createAdminClient();

  // Make sure the account exists (an "already registered" error is fine).
  await admin.auth.admin.createUser({ email, email_confirm: true });

  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !data.properties?.hashed_token) {
    console.error('dev-login: generateLink failed', error);
    return NextResponse.redirect(`${origin}/login?error=link`);
  }

  const cacheHeaders: Record<string, string> = {};
  const supabase = await createSessionClient((headers) => Object.assign(cacheHeaders, headers));
  const verified = await supabase.auth.verifyOtp({ type: 'email', token_hash: data.properties.hashed_token });
  if (verified.error) {
    console.error('dev-login: verifyOtp failed', verified.error);
    return NextResponse.redirect(`${origin}/login?error=link`);
  }

  const response = NextResponse.redirect(`${origin}${next}`);
  for (const [key, value] of Object.entries(cacheHeaders)) response.headers.set(key, value);
  return response;
}
