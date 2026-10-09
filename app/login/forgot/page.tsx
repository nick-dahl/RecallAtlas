import { SiteHeader } from '@/components/site-header';
import { ForgotForm } from './forgot-form';

export const metadata = { title: 'Reset your password' };

export default function ForgotPasswordPage() {
  return (
    <>
      <SiteHeader signedIn={false} />
      <main className="relative z-10 mx-auto flex max-w-sm flex-col gap-6 px-6 pb-24 pt-16">
        <h1 className="font-display text-4xl tracking-tight">Reset your password</h1>
        <p className="text-ink-soft">We’ll email you a link to choose a new password.</p>
        <ForgotForm />
      </main>
    </>
  );
}
