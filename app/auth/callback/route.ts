import { NextResponse, type NextRequest } from 'next/server';
import { safeNext } from '@/lib/auth/safe-next';
import { createSessionClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));
  if (code) {
    const cacheHeaders: Record<string, string> = {};
    const supabase = await createSessionClient((headers) => Object.assign(cacheHeaders, headers));
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`);
      for (const [key, value] of Object.entries(cacheHeaders)) response.headers.set(key, value);
      return response;
    }
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
