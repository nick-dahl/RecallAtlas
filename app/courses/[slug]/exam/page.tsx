import { notFound } from 'next/navigation';
import { SessionPlayer } from '@/components/session/session-player';
import { getCourse } from '@/lib/content/registry';
import { requireUserId } from '@/lib/supabase/server';

export const metadata = { title: 'Final exam' };

export default async function ExamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!getCourse(slug)) notFound();
  await requireUserId();
  return <SessionPlayer slug={slug} kind="exam" />;
}
