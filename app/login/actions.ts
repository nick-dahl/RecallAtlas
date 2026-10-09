'use server';

import { redirect } from 'next/navigation';
import { isRateLimited, MESSAGES, normalizeEmail, PASSWORD_MIN, signInErrorMessage, validateCredentials } from '@/lib/auth/account';
import { safeNext } from '@/lib/auth/safe-next';
import { siteUrl } from '@/lib/env';
import { createSessionClient } from '@/lib/supabase/server';

export interface LoginState {
  status: 'idle' | 'sent' | 'error';
  message?: string;
}

/** Never show the learner Supabase's raw error message; it can leak internal details. */
const SEND_FAILED_MESSAGE = "Couldn't send the sign-in link. Please try again in a minute.";

/** The secondary option: an emailed sign-in link (also works as confirmation; see lib/auth/verify.ts). */
export async function sendMagicLink(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  if (validateCredentials(email, 'x'.repeat(PASSWORD_MIN))) return { status: 'error', message: MESSAGES.invalidEmail };

  const next = safeNext(String(formData.get('next') ?? ''));
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (isRateLimited(error)) return { status: 'error', message: MESSAGES.wait };
  if (error) {
    console.error('sendMagicLink failed:', error.status, error.code);
    return { status: 'error', message: SEND_FAILED_MESSAGE };
  }
  return { status: 'sent' };
}

/** Email and password, for every account. One message for every failure: it never reveals which emails exist. */
export async function signInWithPassword(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const password = String(formData.get('password') ?? '');
  const next = safeNext(String(formData.get('next') ?? ''));
  if (!email || !password) return { status: 'error', message: MESSAGES.signInFailed };

  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (!isRateLimited(error) && error.code !== 'invalid_credentials') console.error('signInWithPassword failed:', error.status, error.code);
    return { status: 'error', message: signInErrorMessage(error) };
  }
  redirect(next);
}

export interface ResetState {
  status: 'idle' | 'sent' | 'error';
  message?: string;
}

/** Always the same answer, so the form never reveals whether an email has an account. */
export async function requestPasswordReset(_previous: ResetState, formData: FormData): Promise<ResetState> {
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  if (validateCredentials(email, 'x'.repeat(PASSWORD_MIN))) return { status: 'error', message: MESSAGES.invalidEmail };
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?next=%2Faccount%2Fpassword`,
  });
  if (isRateLimited(error)) return { status: 'error', message: MESSAGES.wait };
  if (error) console.error('requestPasswordReset failed:', error.status, error.code);
  return { status: 'sent', message: MESSAGES.resetSent };
}
