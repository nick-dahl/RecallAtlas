import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { buttonClass } from '@/components/ui/button';
import { Flag } from '@/components/ui/flag';
import { getUserId } from '@/lib/supabase/server';

const SHOWCASE = ['NP', 'TD', 'KI', 'BT', 'RO', 'JP'];

export default async function Home() {
  if (await getUserId()) redirect('/dashboard');
  return (
    <>
      <SiteHeader signedIn={false} />
      <main className="relative z-10 mx-auto grid max-w-5xl gap-14 px-6 pb-24 pt-8 md:grid-cols-[1.1fr_.9fr] md:items-center md:pt-16">
        <div className="animate-rise space-y-6">
          <p className="font-mono text-xs uppercase tracking-[.2em] text-ink-soft">197 flags · one album</p>
          <h1 className="font-display text-5xl leading-[1.02] tracking-tight md:text-6xl">
            Learn every flag.
            <br />
            <span className="text-accent">Keep</span> every flag.
          </h1>
          <p className="max-w-md text-lg text-ink-soft">
            Recall Atlas spends your time on the flags you mix up (Chad or Romania?) and quietly retires the ones
            you already know.
          </p>
          <Link href="/login" className={buttonClass('primary', 'px-7 py-3 text-base')}>
            Start learning
          </Link>
        </div>
        <div className="grid -rotate-3 grid-cols-3 gap-5" aria-hidden>
          {SHOWCASE.map((key, i) => (
            <div
              key={key}
              className="animate-rise"
              style={{ animationDelay: `${150 + i * 70}ms`, filter: i === 1 || i === 4 ? 'grayscale(1)' : undefined }}
            >
              <Flag src={`/api/flag-art/${key}`} eager />
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
