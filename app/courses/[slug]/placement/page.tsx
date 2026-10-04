import { notFound, redirect } from 'next/navigation';
import { SessionPlayer } from '@/components/session/session-player';
import { getCourse } from '@/lib/content/registry';
import { createServiceContext } from '@/lib/server/context';
import { getCourseOverview } from '@/lib/study/overview-service';
import { requireUserId } from '@/lib/supabase/server';

export const metadata = { title: 'Placement' };

export default async function PlacementPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = getCourse(slug);
  if (!course) notFound();
  const userId = await requireUserId();
  const o = await getCourseOverview(createServiceContext(userId, course));
  if (!o.enrolled) redirect('/dashboard');
  // Placement is only reachable before it's completed; otherwise the course page is the
  // source of truth for what to do next.
  if (o.status !== 'placement') redirect(`/courses/${slug}`);
  return <SessionPlayer slug={slug} kind="placement" />;
}
