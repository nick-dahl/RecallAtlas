import { isEmailConfirmed } from '@/lib/auth/account';
import { createSessionClient } from '@/lib/supabase/server';
import { ResendButton } from './resend-button';

/**
 * Asks an unconfirmed account to confirm its email. Never blocks anything. Reads the user fresh
 * (getUser, not the JWT), so a confirmation made on another device shows on the next page load.
 */
export async function ConfirmBanner() {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user?.email || isEmailConfirmed(user)) return null;
  return (
    <div
      data-testid="confirm-banner"
      role="status"
      className="relative z-10 mx-auto mb-6 flex max-w-5xl flex-wrap items-center gap-3 rounded-2xl bg-raised px-4 py-3 text-sm ring-1 ring-rule"
    >
      <span>
        Confirm your email: we sent a link to <strong>{user.email}</strong>.
      </span>
      <ResendButton />
    </div>
  );
}
