import { notFound } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { buttonClass } from '@/components/ui/button';
import { devToolsEnabled } from '@/lib/dev/dev-tools';
import { requireUserId } from '@/lib/supabase/server';
import { makeExamReady, resetProgress } from './actions';

export const metadata = { title: 'Dev tools' };

/** DEVELOPMENT ONLY: shortcuts for reviewing every screen. 404s unless `next dev` + DEV_LOGIN_EMAIL. */
export default async function DevPage() {
  if (!devToolsEnabled()) notFound();
  await requireUserId();
  return (
    <>
      <SiteHeader />
      <main className="relative z-10 mx-auto max-w-xl space-y-8 px-6 pb-24">
        <div className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[.15em] text-ink-soft">Development only</p>
          <h1 className="font-display text-4xl tracking-tight">Dev tools</h1>
          <p className="text-ink-soft">Shortcuts for the signed-in account’s World Flags progress.</p>
        </div>
        <section className="space-y-3 rounded-2xl bg-raised p-5 ring-1 ring-rule">
          <h2 className="font-display text-xl">Start over</h2>
          <p className="text-sm text-ink-soft">
            Deletes all World Flags progress (enrollment, sessions, answers, confusions). You’ll be a brand-new learner.
          </p>
          <form action={resetProgress}>
            <button className={buttonClass('secondary')}>Reset World Flags progress</button>
          </form>
        </section>
        <section className="space-y-3 rounded-2xl bg-raised p-5 ring-1 ring-rule">
          <h2 className="font-display text-xl">Jump to the final exam</h2>
          <p className="text-sm text-ink-soft">
            Enrolls you, finishes placement, and marks every prompt as learned, so the exam unlocks.
          </p>
          <form action={makeExamReady}>
            <button className={buttonClass('primary')}>Make exam-ready</button>
          </form>
        </section>
      </main>
    </>
  );
}
