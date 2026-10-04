import { notFound, redirect } from 'next/navigation';
import { SessionPlayer } from '@/components/session/session-player';
import { getCourse } from '@/lib/content/registry';
import { createServiceContext } from '@/lib/server/context';
import { getCourseOverview } from '@/lib/study/overview-service';
import { requireUserId } from '@/lib/supabase/server';

export const metadata = { title: 'Final exam' };

export default async function ExamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = getCourse(slug);
  if (!course) notFound();
  const userId = await requireUserId();
  const o = await getCourseOverview(createServiceContext(userId, course));
  if (!o.enrolled) redirect('/dashboard');
  // The exam is only reachable when it's unlocked or already in progress; otherwise the
  // course page is the source of truth (it also shows the last exam attempt, if any).
  if (!(o.status === 'exam_ready' || o.activeSessionKind === 'exam')) redirect(`/courses/${slug}`);
  return <SessionPlayer slug={slug} kind="exam" />;
}
