'use client';

import { useActionState } from 'react';
import { buttonClass } from '@/components/ui/button';
import { sendMagicLink, type LoginState } from './actions';

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, { status: 'idle' });

  if (state.status === 'sent') {
    return (
      <p className="animate-rise rounded-2xl bg-good-soft px-4 py-3 text-good">
        Check your email for a sign-in link.
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email" className="text-sm font-medium">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoFocus
        autoComplete="email"
        className="rounded-2xl bg-raised px-4 py-3 outline-none ring-2 ring-rule transition focus:ring-accent"
      />
      <button type="submit" disabled={pending} className={buttonClass('primary', 'py-3')}>
        {pending ? 'Sending…' : 'Email me a sign-in link'}
      </button>
      {state.status === 'error' && <p className="text-sm text-bad">{state.message}</p>}
    </form>
  );
}
