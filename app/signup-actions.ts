'use server';

import { redirect } from 'next/navigation';
import { MESSAGES, normalizeEmail, signUpErrorMessage, validateCredentials } from '@/lib/auth/account';
import { siteUrl } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { createSessionClient } from '@/lib/supabase/server';

export interface SignUpState {
  status: 'idle' | 'error';
  message?: string;
  /** The email already has an account: offer a prefilled sign-in. */
  exists?: boolean;
  email?: string;
}

/**
 * Creates the account (already confirmed in Supabase's terms, so it works whatever the dashboard's
 * "Confirm email" setting), signs it in, and sends our confirmation: a sign-in link whose use marks
 * the account confirmed (lib/auth/verify.ts). A failed send isn't fatal; the banner can resend.
 */
export async function signUp(_previous: SignUpState, formData: FormData): Promise<SignUpState> {
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const password = String(formData.get('password') ?? '');
  const invalid = validateCredentials(email, password);
  if (invalid) return { status: 'error', message: invalid, email };

  const { error: createError } = await createAdminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // Asks this account to confirm its email (banner) until an emailed link is used.
    app_metadata: { confirm_pending: true },
  });
  if (createError) {
    const message = signUpErrorMessage(createError);
    if (message !== MESSAGES.exists) console.error('signUp createUser failed:', createError.status, createError.code);
    return { status: 'error', message, exists: message === MESSAGES.exists, email };
  }

  const supabase = await createSessionClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    console.error('signUp sign-in failed:', signInError.status, signInError.code);
    return { status: 'error', message: MESSAGES.createFailed, email };
  }
  const { error: sendError } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${siteUrl()}/auth/callback?next=%2Fdashboard` },
  });
  if (sendError) console.error('signUp confirmation send failed:', sendError.status, sendError.code);
  redirect('/dashboard');
}
