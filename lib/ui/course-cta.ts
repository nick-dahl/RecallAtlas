import type { CourseOverview } from '@/lib/study/overview-service';

export interface Cta {
  label: string;
  href: string;
}

/** The one primary action a course offers right now. Null when not enrolled. */
export function primaryCta(
  o: Pick<CourseOverview, 'slug' | 'enrolled' | 'status' | 'dueCount' | 'activeSessionKind'>,
): Cta | null {
  if (!o.enrolled) return null;
  const base = `/courses/${o.slug}`;
  if (o.activeSessionKind === 'exam') return { label: 'Resume exam', href: `${base}/exam` };
  switch (o.status) {
    case 'placement':
      return {
        label: o.activeSessionKind === 'placement' ? 'Continue placement' : 'Start placement',
        href: `${base}/placement`,
      };
    case 'exam_ready':
      return { label: 'Take the final exam', href: `${base}/exam` };
    case 'passed':
      return o.dueCount > 0
        ? { label: `Review · ${o.dueCount} due`, href: `${base}/study` }
        : { label: 'Practice ahead', href: `${base}/study?mode=practice-ahead` };
    default:
      return { label: o.dueCount > 0 ? `Study · ${o.dueCount} due` : 'Study', href: `${base}/study` };
  }
}
