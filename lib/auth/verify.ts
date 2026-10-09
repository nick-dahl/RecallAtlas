import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Records that the account's owner opened an emailed link (our confirmation; see lib/auth/account.ts).
 * Only the server can write app_metadata. The first date is kept.
 */
export async function markEmailVerified(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) return;
  if (data.user.app_metadata?.email_verified_at) return;
  await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...data.user.app_metadata, email_verified_at: new Date().toISOString() },
  });
}
