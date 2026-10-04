import Link from 'next/link';
import { enrollAndOpen } from '@/app/dashboard/actions';
import { buttonClass } from '@/components/ui/button';
import { ReadinessMeter } from '@/components/ui/readiness-meter';
import { StatusPill } from '@/components/ui/status-pill';
import type { CourseOverview } from '@/lib/study/overview-service';
import { primaryCta } from '@/lib/ui/course-cta';

export function CourseCard({ overview: o }: { overview: CourseOverview }) {
  const cta = primaryCta(o);
  return (
    <article className="animate-rise flex flex-col gap-5 rounded-3xl bg-raised p-6 ring-1 ring-rule">
      <div className="flex items-start justify-between gap-3">
        <Link href={o.enrolled ? `/courses/${o.slug}` : '#'} className="font-display text-2xl tracking-tight hover:text-accent">
          {o.title}
        </Link>
        {o.status && <StatusPill status={o.status} />}
      </div>
      {o.enrolled ? (
        <ReadinessMeter graduated={o.readiness.graduated} total={o.readiness.total} />
      ) : (
        <p className="text-sm text-ink-soft">All 197 flags, from Andorra to Zimbabwe.</p>
      )}
      <div className="mt-auto">
        {cta ? (
          <Link href={cta.href} className={buttonClass('primary')}>
            {cta.label}
          </Link>
        ) : (
          <form action={enrollAndOpen.bind(null, o.slug)}>
            <button className={buttonClass('primary')}>Start course</button>
          </form>
        )}
      </div>
    </article>
  );
}

export function ComingSoonCard({ title, blurb }: { title: string; blurb: string }) {
  return (
    <article className="flex flex-col gap-3 rounded-3xl border border-dashed border-rule p-6 text-ink-soft">
      <h2 className="font-display text-2xl tracking-tight">{title}</h2>
      <p className="text-sm">{blurb}</p>
      <p className="mt-auto font-mono text-[11px] uppercase tracking-[.15em]">Coming soon</p>
    </article>
  );
}
