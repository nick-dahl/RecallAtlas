import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { Painting } from '@/components/ui/painting';
import { GREAT_PAINTINGS, paintingByRank } from '@/lib/content/great-paintings';
import { createServiceContext } from '@/lib/server/context';
import { getCourseOverview } from '@/lib/study/overview-service';
import { requireUserId } from '@/lib/supabase/server';

type Props = { params: Promise<{ slug: string; rank: string }> };

// Never the painting's title: the tab would name a painting the learner hasn't met.
export const metadata: Metadata = { title: 'Painting' };

/** The enlarged reference view of one painting from the gallery wall. Labels only once introduced. */
export default async function PaintingPage({ params }: Props) {
  const { slug, rank } = await params;
  const record = slug === GREAT_PAINTINGS.slug ? paintingByRank(Number(rank)) : null;
  if (!record) notFound();
  const userId = await requireUserId();
  const o = await getCourseOverview(createServiceContext(userId, GREAT_PAINTINGS));
  if (!o.enrolled) redirect('/dashboard');
  const introduced = o.tiles.find((t) => t.key === record.key)?.tile !== 'new';

  return (
    <>
      <SiteHeader />
      <main className="relative z-10 mx-auto max-w-5xl space-y-6 px-6 pb-24">
        <Link href={`/courses/${slug}`} className="text-sm text-ink-soft hover:text-ink">
          ← Your gallery
        </Link>
        <Painting
          src={`/api/painting-art/${record.fame}`}
          alt={introduced ? record.title : ''}
          detail={record.detail}
          eager
          maxHeight="75vh"
          className="mx-auto w-fit max-w-full"
        />
        {introduced ? (
          <div className="space-y-1 text-center">
            <h1 className="font-display text-3xl italic tracking-tight">{record.title}</h1>
            <p>
              {record.artist}, {record.year}
            </p>
            <p className="text-sm text-ink-soft">
              {record.movement} · {record.museum}
            </p>
          </div>
        ) : (
          <p className="text-center text-ink-soft">You haven’t met this painting yet.</p>
        )}
      </main>
    </>
  );
}
