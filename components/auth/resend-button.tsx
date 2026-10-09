'use client';

import { useActionState } from 'react';
import { resendConfirmation } from '@/app/account/resend-action';
import { buttonClass } from '@/components/ui/button';

export function ResendButton() {
  const [state, action, pending] = useActionState<{ message?: string }>(resendConfirmation, {});
  return (
    <form action={action} className="flex items-center gap-3">
      <button type="submit" disabled={pending} className={buttonClass('secondary', 'px-3 py-1 text-sm')}>
        {pending ? 'Sending…' : 'Resend'}
      </button>
      {state.message && <span className="text-ink-soft">{state.message}</span>}
    </form>
  );
}
