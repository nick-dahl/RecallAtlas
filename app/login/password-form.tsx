'use client';

import { useActionState } from 'react';
import { buttonClass } from '@/components/ui/button';
import { signInWithAdminPassword, type LoginState } from './actions';

const FIELD = 'rounded-2xl bg-raised px-4 py-3 outline-none ring-2 ring-rule transition focus:ring-accent';

export function PasswordForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signInWithAdminPassword, { status: 'idle' });
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="admin-email" className="text-sm font-medium">
        Email
      </label>
      <input id="admin-email" name="email" type="email" required autoComplete="username" className={FIELD} />
      <label htmlFor="admin-password" className="text-sm font-medium">
        Password
      </label>
      <input id="admin-password" name="password" type="password" required autoComplete="current-password" className={FIELD} />
      <button type="submit" disabled={pending} className={buttonClass('primary', 'py-3')}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
      {state.status === 'error' && <p className="text-sm text-bad">{state.message}</p>}
    </form>
  );
}
