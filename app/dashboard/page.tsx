import { ComingSoonCard, CourseCard } from '@/components/course-card';
import { SiteHeader } from '@/components/site-header';
import { listCourses } from '@/lib/content/registry';
import { createServiceContext } from '@/lib/server/context';
import { getCourseOverview } from '@/lib/study/overview-service';
import { requireUserId } from '@/lib/supabase/server';

export const metadata = { title: 'Your atlas' };

const COMING_SOON = [
  { title: 'US Presidents', blurb: 'All 46, in order, by face and number.' },
];

export default async function DashboardPage() {
  const userId = await requireUserId();
  const overviews = await Promise.all(listCourses().map((c) => getCourseOverview(createServiceContext(userId, c))));
  return (
    <>
      <SiteHeader />
      <main className="relative z-10 mx-auto max-w-5xl space-y-8 px-6 pb-24">
        <h1 className="font-display text-4xl tracking-tight">Your atlas</h1>
        <div className="grid gap-5 md:grid-cols-3">
          {overviews.map((o) => (
            <CourseCard key={o.slug} overview={o} />
          ))}
          {COMING_SOON.map((c) => (
            <ComingSoonCard key={c.title} {...c} />
          ))}
        </div>
      </main>
    </>
  );
}
