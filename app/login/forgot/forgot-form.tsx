'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { buttonClass } from '@/components/ui/button';
import { requestPasswordReset, type ResetState } from '../actions';

const FIELD = 'rounded-2xl bg-raised px-4 py-3 outline-none ring-2 ring-rule transition focus:ring-accent';

export function ForgotForm() {
  const [state, action, pending] = useActionState<ResetState, FormData>(requestPasswordReset, { status: 'idle' });
  return (
    <div className="flex flex-col gap-4">
      {state.status === 'sent' ? (
        <p role="status" className="animate-rise rounded-2xl bg-good-soft px-4 py-3 text-good">
          {state.message}
        </p>
      ) : (
        <form action={action} className="flex flex-col gap-3">
          <label htmlFor="forgot-email" className="text-sm font-medium">
            Email
          </label>
          <input id="forgot-email" name="email" type="email" required autoFocus autoComplete="email" className={FIELD} />
          <button type="submit" disabled={pending} className={buttonClass('primary', 'py-3')}>
            {pending ? 'Sending…' : 'Send reset link'}
          </button>
          {state.status === 'error' && (
            <p role="alert" className="text-sm text-bad">
              {state.message}
            </p>
          )}
        </form>
      )}
      <Link href="/login" className="text-center text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}
