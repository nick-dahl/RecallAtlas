'use server';

import { redirect } from 'next/navigation';
import { newPasswordError, updatePasswordErrorMessage } from '@/lib/auth/account';
import { createSessionClient } from '@/lib/supabase/server';

/** Sets the signed-in account's password (after a reset link, or a first password for an email-link account). */
export async function updatePassword(_previous: { message?: string }, formData: FormData): Promise<{ message?: string }> {
  const password = String(formData.get('password') ?? '');
  const invalid = newPasswordError(password, String(formData.get('confirm') ?? ''));
  if (invalid) return { message: invalid };
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code !== 'same_password') console.error('updatePassword failed:', error.status, error.code);
    return { message: updatePasswordErrorMessage(error) };
  }
  redirect('/dashboard?notice=password');
}
