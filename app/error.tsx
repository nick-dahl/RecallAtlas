'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { buttonClass } from '@/components/ui/button';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[.2em] text-accent">Error</p>
      <h1 className="font-display text-4xl tracking-tight">Something went wrong</h1>
      <p className="text-ink-soft">An unexpected error interrupted the page. You can try again, or head back home.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className={buttonClass('primary')}>
          Try again
        </button>
        <Link href="/" className={buttonClass('secondary')}>
          Back home
        </Link>
      </div>
    </main>
  );
}
