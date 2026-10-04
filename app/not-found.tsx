import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';

export const metadata = { title: 'Not found' };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[.2em] text-accent">404</p>
      <h1 className="font-display text-4xl tracking-tight">Off the map</h1>
      <p className="text-ink-soft">That page doesn’t exist, or you don’t have access to it.</p>
      <Link href="/" className={buttonClass('primary')}>
        Back home
      </Link>
    </main>
  );
}
