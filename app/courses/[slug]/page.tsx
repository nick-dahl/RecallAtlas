import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { MasteryMap } from '@/components/map/mastery-map';
import { SiteHeader } from '@/components/site-header';
import { buttonClass } from '@/components/ui/button';
import { Flag } from '@/components/ui/flag';
import { ReadinessMeter } from '@/components/ui/readiness-meter';
import { StatusPill } from '@/components/ui/status-pill';
import { getCourse } from '@/lib/content/registry';
import { loadAtlas } from '@/lib/map/atlas';
import { createServiceContext } from '@/lib/server/context';
import { getCourseOverview } from '@/lib/study/overview-service';
import { itemImage } from '@/lib/ui/item-image';
import { getMapSupport } from '@/lib/study/presenters';
import { requireUserId } from '@/lib/supabase/server';
import { offersPracticeAhead, primaryCta } from '@/lib/ui/course-cta';
import { albumSummary, groupTiles, TILE_STYLE } from '@/lib/ui/tiles';
import { skipPlacementAndStudy } from './actions';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getCourse((await params).slug)?.title ?? 'Course' };
}

export default async function CoursePage({ params }: Props) {
  const { slug } = await params;
  const course = getCourse(slug);
  if (!course) notFound();
  const userId = await requireUserId();
  const o = await getCourseOverview(createServiceContext(userId, course));
  if (!o.enrolled) redirect('/dashboard');

  const cta = primaryCta(o);
  const summary = albumSummary(o.tiles);
  const exam = o.lastExamAttempt;
  const isMap = getMapSupport(course) !== undefined;

  return (
    <>
      <SiteHeader />
      <main className="relative z-10 mx-auto max-w-5xl space-y-14 px-6 pb-24">
        <section className="animate-rise space-y-5">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-ink-soft hover:text-ink">
              ← Atlas
            </Link>
            {o.status && <StatusPill status={o.status} />}
          </div>
          <h1 className="font-display text-5xl tracking-tight">{o.title}</h1>
          <div className="max-w-xl">
            <ReadinessMeter graduated={o.readiness.graduated} total={o.readiness.total} />
          </div>
          <p className="text-sm text-ink-soft">
            {summary.learned} learned · {summary.learning} in progress · {summary.new} to go
            {o.dueCount > 0 && ` · ${o.dueCount} reviews due`}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {cta && (
              <Link href={cta.href} className={buttonClass('primary')}>
                {cta.label}
              </Link>
            )}
            {o.status === 'placement' && (
              <form action={skipPlacementAndStudy.bind(null, slug)}>
                <button className={buttonClass('secondary')}>Skip placement</button>
              </form>
            )}
            {offersPracticeAhead(o) && (
              <Link href={`/courses/${slug}/study?mode=practice-ahead`} className={buttonClass('ghost')}>
                Practice ahead
              </Link>
            )}
          </div>
          {o.nudge && (
            <p className="max-w-xl rounded-2xl bg-learning/15 px-4 py-3 text-sm">
              Your recall is fading. A quick review will top it up.
            </p>
          )}
        </section>

        {exam && !exam.passed && (
          <section className="space-y-3">
            <h2 className="font-display text-2xl">
              Last exam: {exam.score}/{exam.total}
            </h2>
            <p className="text-sm text-ink-soft">These went back into practice. The exam unlocks again once they stick.</p>
            <ul className="flex flex-wrap gap-3">
              {exam.missed.map((m) => (
                <li key={m.name} className="w-20 space-y-1 text-xs">
                  <Flag src={itemImage(m)} alt={m.name} />
                  <span>{m.name}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {o.topConfusions.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-2xl">Easy to mix up</h2>
            <ul className="flex flex-wrap gap-2">
              {o.topConfusions.map((c) => (
                <li key={`${c.a}|${c.b}`} className="rounded-full bg-raised px-3 py-1 text-sm ring-1 ring-rule">
                  {c.a} ↔ {c.b} <span className="text-ink-soft">×{c.count}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {isMap ? (
          <section className="space-y-5">
            <h2 className="font-display text-2xl">Your map</h2>
            <MasteryMap atlas={loadAtlas()} tiles={o.tiles} />
          </section>
        ) : (
          <section className="space-y-8">
            <h2 className="font-display text-2xl">Your album</h2>
            {groupTiles(o.tiles).map((g) => (
              <div key={g.group} className="space-y-3">
                <h3 className="font-mono text-xs uppercase tracking-[.2em] text-ink-soft">{g.group}</h3>
                <ul className="grid grid-cols-4 gap-x-4 gap-y-5 sm:grid-cols-6 md:grid-cols-8">
                  {g.tiles.map((t) => {
                    const style = TILE_STYLE[t.tile];
                    return (
                      <li key={t.key} title={`${t.name}: ${style.label}`} className="space-y-1.5">
                        <div
                          style={{ filter: style.filter }}
                          className={`transition-[filter] duration-500 ${style.ring ? 'rounded-md ring-2 ring-gold ring-offset-2 ring-offset-paper' : ''}`}
                        >
                          <Flag src={`/api/flag-art/${t.key}`} />
                        </div>
                        <p className="truncate text-[11px] text-ink-soft">{t.name}</p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>
        )}
      </main>
    </>
  );
}
