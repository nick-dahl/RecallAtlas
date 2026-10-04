'use client';

import { useActionState } from 'react';
import { sendMagicLink, type LoginState } from './actions';

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, { status: 'idle' });

  if (state.status === 'sent') {
    return <p className="text-lg">Check your email for a sign-in link.</p>;
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email" className="font-medium">
        Email
      </label>
      <input id="email" name="email" type="email" required autoFocus className="rounded border px-3 py-2" />
      <button type="submit" disabled={pending} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
        {pending ? 'Sending…' : 'Email me a sign-in link'}
      </button>
      {state.status === 'error' && <p className="text-red-600">{state.message}</p>}
    </form>
  );
}
