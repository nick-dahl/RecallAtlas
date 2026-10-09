import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { buttonClass } from '@/components/ui/button';
import { safeNext } from '@/lib/auth/safe-next';
import { devLoginEmail } from '@/lib/dev/dev-tools';
import { LoginForm } from './login-form';
import { PasswordForm } from './password-form';

export const metadata = { title: 'Sign in' };

const LINK = 'text-center text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline';

/**
 * Sign-in: email and password first; an emailed sign-in link is the secondary option
 * (`?method=link`). `?method=password` (old bookmarks) is the default view.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; method?: string; email?: string }>;
}) {
  const { next, error, method, email } = await searchParams;
  const devEmail = devLoginEmail();
  const target = safeNext(next);
  const withLink = method === 'link';
  const switchHref = `/login?${new URLSearchParams({ next: target, ...(withLink ? {} : { method: 'link' }) })}`;
  return (
    <>
      <SiteHeader signedIn={false} />
      <main className="relative z-10 mx-auto flex max-w-sm flex-col gap-6 px-6 pb-24 pt-16">
        <h1 className="font-display text-4xl tracking-tight">Sign in</h1>
        {withLink ? (
          <p className="text-ink-soft">We’ll email you a link. Open it to sign in.</p>
        ) : (
          <p className="text-ink-soft">Welcome back.</p>
        )}
        {error && (
          <p className="rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">That sign-in link didn’t work. Request a new one.</p>
        )}
        {withLink ? <LoginForm next={target} /> : <PasswordForm next={target} email={email} />}
        <Link href={switchHref} className={LINK}>
          {withLink ? 'Sign in with a password' : 'Email me a sign-in link instead'}
        </Link>
        <p className="text-center text-sm text-ink-soft">
          New here?{' '}
          <Link href="/" className="font-medium text-ink underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>
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
