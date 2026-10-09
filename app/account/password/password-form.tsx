'use client';

import { useActionState } from 'react';
import { buttonClass } from '@/components/ui/button';
import { PASSWORD_MIN } from '@/lib/auth/account';
import { updatePassword } from './actions';

const FIELD = 'rounded-2xl bg-raised px-4 py-3 outline-none ring-2 ring-rule transition focus:ring-accent';

export function NewPasswordForm() {
  const [state, action, pending] = useActionState<{ message?: string }, FormData>(updatePassword, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="new-password" className="text-sm font-medium">
        New password
      </label>
      <input id="new-password" name="password" type="password" required minLength={PASSWORD_MIN} autoFocus autoComplete="new-password" className={FIELD} />
      <label htmlFor="confirm-password" className="text-sm font-medium">
        Confirm new password
      </label>
      <input id="confirm-password" name="confirm" type="password" required minLength={PASSWORD_MIN} autoComplete="new-password" className={FIELD} />
      <p className="text-xs text-ink-soft">At least {PASSWORD_MIN} characters.</p>
      <button type="submit" disabled={pending} className={buttonClass('primary', 'py-3')}>
        {pending ? 'Saving…' : 'Save password'}
      </button>
      {state.message && (
        <p role="alert" className="text-sm text-bad">
          {state.message}
        </p>
      )}
    </form>
  );
}
