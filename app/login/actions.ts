'use server';

import { safeNext } from '@/lib/auth/safe-next';
import { siteUrl } from '@/lib/env';
import { createSessionClient } from '@/lib/supabase/server';

export interface LoginState {
  status: 'idle' | 'sent' | 'error';
  message?: string;
}

/** Never show the learner Supabase's raw error message; it can leak internal details. */
const SEND_FAILED_MESSAGE = "Couldn't send the sign-in link. Please try again in a minute.";

export async function sendMagicLink(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: 'error', message: 'Enter a valid email address.' };

  const next = safeNext(String(formData.get('next') ?? ''));
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) {
    console.error('sendMagicLink failed:', error);
    return { status: 'error', message: SEND_FAILED_MESSAGE };
  }
  return { status: 'sent' };
}
