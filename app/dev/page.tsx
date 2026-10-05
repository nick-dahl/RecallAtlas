import { notFound } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { buttonClass } from '@/components/ui/button';
import { listCourses } from '@/lib/content/registry';
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
      <main className="relative z-10 mx-auto max-w-xl space-y-10 px-6 pb-24">
        <div className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[.15em] text-ink-soft">Development only</p>
          <h1 className="font-display text-4xl tracking-tight">Dev tools</h1>
          <p className="text-ink-soft">Shortcuts for the signed-in account’s progress, per course.</p>
        </div>
        {listCourses().map((course) => (
          <section key={course.slug} className="space-y-4 rounded-2xl bg-raised p-5 ring-1 ring-rule">
            <h2 className="font-display text-2xl">{course.title}</h2>
            <div className="space-y-2">
              <p className="text-sm text-ink-soft">
                Start over: deletes all {course.title} progress (enrollment, sessions, answers, confusions).
              </p>
              <form action={resetProgress.bind(null, course.slug)}>
                <button className={buttonClass('secondary')}>Reset {course.title} progress</button>
              </form>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-ink-soft">
                Jump to the final exam: enrolls you, finishes placement, and marks every prompt as learned.
              </p>
              <form action={makeExamReady.bind(null, course.slug)}>
                <button className={buttonClass('primary')}>Make {course.title} exam-ready</button>
              </form>
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
