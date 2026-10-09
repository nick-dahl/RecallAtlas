import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { confirmDestination } from '@/lib/auth/account';
import { markEmailVerified } from '@/lib/auth/verify';
import { createSessionClient } from '@/lib/supabase/server';

const TYPES = new Set<EmailOtpType>(['email', 'magiclink', 'signup', 'recovery', 'invite', 'email_change']);

/**
 * Every emailed link (confirmation, sign-in link, password reset) lands here with a one-time token
 * hash. Unlike the PKCE callback, this needs nothing stored in the requesting browser, so a link
 * works on any device. Opening any of them proves the inbox, so the account is marked confirmed.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  if (tokenHash && type && TYPES.has(type)) {
    const cacheHeaders: Record<string, string> = {};
    const supabase = await createSessionClient((headers) => Object.assign(cacheHeaders, headers));
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error && data.user) {
      await markEmailVerified(data.user.id);
      const response = NextResponse.redirect(`${origin}${confirmDestination(searchParams)}`);
      for (const [key, value] of Object.entries(cacheHeaders)) response.headers.set(key, value);
      return response;
    }
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
