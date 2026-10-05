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

/**
 * Practice ahead (a short retention check of learned material) is offered next to the primary
 * action whenever something has been learned, unless placement or an exam is underway, or it is
 * already the primary action.
 */
export function offersPracticeAhead(
  o: Pick<CourseOverview, 'slug' | 'enrolled' | 'status' | 'dueCount' | 'activeSessionKind' | 'readiness'>,
): boolean {
  if (!o.enrolled || o.readiness.graduated === 0) return false;
  if (o.status === 'placement' || o.activeSessionKind === 'exam') return false;
  return primaryCta(o)?.label !== 'Practice ahead';
}
