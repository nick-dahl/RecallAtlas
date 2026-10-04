'use server';

import { headers } from 'next/headers';
import { safeNext } from '@/lib/auth/safe-next';
import { createSessionClient } from '@/lib/supabase/server';

export interface LoginState {
  status: 'idle' | 'sent' | 'error';
  message?: string;
}

export async function sendMagicLink(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: 'error', message: 'Enter a valid email address.' };

  const next = safeNext(String(formData.get('next') ?? ''));
  const origin = (await headers()).get('origin') ?? 'http://localhost:3000';
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) return { status: 'error', message: error.message };
  return { status: 'sent' };
}
