import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Records that the account's owner opened an emailed link (our confirmation; see lib/auth/account.ts).
 * Only the server can write app_metadata. The first date is kept. Never throws: a failure here must
 * not break the sign-in the link just completed (the banner simply stays until the next link).
 */
export async function markEmailVerified(userId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data.user) {
      console.error('markEmailVerified: user lookup failed:', error?.status, error?.code);
      return;
    }
    if (data.user.app_metadata?.email_verified_at) return;
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: { ...data.user.app_metadata, email_verified_at: new Date().toISOString() },
    });
    if (updateError) console.error('markEmailVerified: update failed:', updateError.status, updateError.code);
  } catch (err) {
    console.error('markEmailVerified failed:', err instanceof Error ? err.name : 'unknown');
  }
}
