import Link from 'next/link';
import { signOut } from '@/app/auth/actions';
import { buttonClass } from '@/components/ui/button';
import { devToolsEnabled } from '@/lib/dev/dev-tools';

export function SiteHeader({ signedIn = true }: { signedIn?: boolean }) {
  return (
    <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
      <Link href={signedIn ? '/dashboard' : '/'} className="font-display text-xl font-semibold tracking-tight">
        Recall<span className="text-accent">·</span>Atlas
      </Link>
      {signedIn ? (
        <div className="flex items-center gap-1">
          {devToolsEnabled() && (
            <Link href="/dev" className={buttonClass('ghost', 'font-mono text-xs uppercase tracking-[.15em]')}>
              Dev tools
            </Link>
          )}
          <form action={signOut}>
            <button className={buttonClass('ghost')}>Sign out</button>
          </form>
        </div>
      ) : (
        <Link href="/login" className={buttonClass('ghost')}>
          Sign in
        </Link>
      )}
    </header>
  );
}
