'use server';

import { isRateLimited, sendResultMessage } from '@/lib/auth/account';
import { siteUrl } from '@/lib/env';
import { createSessionClient } from '@/lib/supabase/server';

/** Sends the confirmation (a sign-in link) again. Opening it marks the account confirmed. */
export async function resendConfirmation(): Promise<{ message?: string }> {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) return {};
  const { error } = await supabase.auth.signInWithOtp({
    email: data.user.email,
    options: { shouldCreateUser: false, emailRedirectTo: `${siteUrl()}/auth/callback?next=%2Fdashboard` },
  });
  if (error && !isRateLimited(error)) console.error('resendConfirmation failed:', error.status, error.code);
  return { message: sendResultMessage(error) };
}
