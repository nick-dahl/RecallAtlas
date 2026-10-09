'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { signUp, type SignUpState } from '@/app/signup-actions';
import { buttonClass } from '@/components/ui/button';
import { PASSWORD_MIN } from '@/lib/auth/account';

const FIELD = 'w-full rounded-2xl bg-raised px-4 py-3 outline-none ring-2 ring-rule transition focus:ring-accent';

/** The landing page's sign-up: email, password, Create account. */
export function SignUpForm() {
  const [state, action, pending] = useActionState<SignUpState, FormData>(signUp, { status: 'idle' });
  const [show, setShow] = useState(false);
  return (
    <form action={action} className="flex max-w-sm flex-col gap-3" aria-label="Create an account">
      <label htmlFor="signup-email" className="text-sm font-medium">Email</label>
      <input id="signup-email" name="email" type="email" required autoComplete="email" defaultValue={state.email} className={FIELD} />
      <label htmlFor="signup-password" className="text-sm font-medium">Password</label>
      <div className="relative">
        <input id="signup-password" name="password" type={show ? 'text' : 'password'} required minLength={PASSWORD_MIN} autoComplete="new-password" className={`${FIELD} pr-16`} />
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-soft hover:text-ink" aria-pressed={show}>
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
      <p className="text-xs text-ink-soft">At least {PASSWORD_MIN} characters.</p>
      <button type="submit" disabled={pending} className={buttonClass('primary', 'px-7 py-3 text-base')}>
        {pending ? 'Creating your account…' : 'Create account'}
      </button>
      {state.status === 'error' && (
        <p role="alert" className="text-sm text-bad">
          {state.message}{' '}
          {state.exists && (
            <Link href={`/login?email=${encodeURIComponent(state.email ?? '')}`} className="underline">
              Sign in instead
            </Link>
          )}
        </p>
      )}
      <p className="text-sm text-ink-soft">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-ink underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
