import { SiteHeader } from '@/components/site-header';
import { requireUserId } from '@/lib/supabase/server';
import { NewPasswordForm } from './password-form';

export const metadata = { title: 'Choose a new password' };

export default async function NewPasswordPage() {
  await requireUserId();
  return (
    <>
      <SiteHeader />
      <main className="relative z-10 mx-auto flex max-w-sm flex-col gap-6 px-6 pb-24 pt-16">
        <h1 className="font-display text-4xl tracking-tight">Choose a new password</h1>
        <NewPasswordForm />
      </main>
    </>
  );
}
