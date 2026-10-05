import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { buttonClass } from '@/components/ui/button';
import { safeNext } from '@/lib/auth/safe-next';
import { devLoginEmail } from '@/lib/dev/dev-tools';
import { LoginForm } from './login-form';
import { PasswordForm } from './password-form';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; method?: string }>;
}) {
  const { next, error, method } = await searchParams;
  const devEmail = devLoginEmail();
  const target = safeNext(next);
  const withPassword = method === 'password';
  const switchHref = `/login?${new URLSearchParams({ next: target, ...(withPassword ? {} : { method: 'password' }) })}`;
  return (
    <>
      <SiteHeader signedIn={false} />
      <main className="relative z-10 mx-auto flex max-w-sm flex-col gap-6 px-6 pb-24 pt-16">
        <h1 className="font-display text-4xl tracking-tight">Sign in</h1>
        {withPassword ? (
          <p className="text-ink-soft">Password sign-in is for the site admin.</p>
        ) : (
          <p className="text-ink-soft">We’ll email you a link. Open it in this browser to sign in.</p>
        )}
        {error && (
          <p className="rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">That sign-in link didn’t work. Request a new one.</p>
        )}
        {withPassword ? <PasswordForm next={target} /> : <LoginForm next={target} />}
        <Link href={switchHref} className="text-center text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline">
          {withPassword ? 'Email me a sign-in link instead' : 'Sign in with a password'}
        </Link>
        {devEmail && (
          <div className="space-y-2 rounded-2xl border border-dashed border-rule p-4">
            <p className="font-mono text-[11px] uppercase tracking-[.15em] text-ink-soft">Development only</p>
            <Link href={`/auth/dev-login?next=${encodeURIComponent(target)}`} className={buttonClass('secondary', 'w-full')}>
              Dev sign-in as {devEmail}
            </Link>
          </div>
        )}
      </main>
    </>
  );
}
