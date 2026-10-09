'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { buttonClass } from '@/components/ui/button';
import { signInWithPassword, type LoginState } from './actions';

const FIELD = 'rounded-2xl bg-raised px-4 py-3 outline-none ring-2 ring-rule transition focus:ring-accent';

/** The main sign-in: email and password, for every account. */
export function PasswordForm({ next, email }: { next: string; email?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signInWithPassword, { status: 'idle' });
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="signin-email" className="text-sm font-medium">
        Email
      </label>
      <input id="signin-email" name="email" type="email" required autoComplete="username" defaultValue={state.email ?? email} autoFocus={!email} className={FIELD} />
      <div className="flex items-baseline justify-between">
        <label htmlFor="signin-password" className="text-sm font-medium">
          Password
        </label>
        <Link href="/login/forgot" className="text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline">
          Forgot password?
        </Link>
      </div>
      <input id="signin-password" name="password" type="password" required autoComplete="current-password" autoFocus={Boolean(email)} className={FIELD} />
      <button type="submit" disabled={pending} className={buttonClass('primary', 'py-3')}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
      {state.status === 'error' && (
        <p role="alert" className="text-sm text-bad">
          {state.message}
        </p>
      )}
    </form>
  );
}
