import { notFound } from 'next/navigation';
import { SessionPlayer } from '@/components/session/session-player';
import { getCourse } from '@/lib/content/registry';
import { requireUserId } from '@/lib/supabase/server';

export const metadata = { title: 'Study' };

export default async function StudyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ mode?: string; size?: string }>;
}) {
  const { slug } = await params;
  if (!getCourse(slug)) notFound();
  await requireUserId();
  const { mode, size } = await searchParams;
  const options = { ...(mode ? { mode } : {}), ...(size ? { size: Number(size) } : {}) };
  // `key` remounts the player when options change (e.g. "Practice ahead" from the end screen).
  return <SessionPlayer key={`${mode ?? ''}-${size ?? ''}`} slug={slug} kind="study" options={options} />;
}
