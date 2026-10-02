import {
  deriveStatus,
  dueCount,
  getItem,
  hydrateStates,
  itemTileState,
  needsReviewNudge,
  readiness,
  retentionHealth,
  topConfusions,
  type EnrollmentStatus,
  type TileState,
} from '@/lib/engine';
import type { ServiceContext } from './context';
import type { SessionKind } from './types';

export interface CourseOverview {
  slug: string;
  title: string;
  enrolled: boolean;
  status: EnrollmentStatus | null;
  passedAt: Date | null;
  readiness: { graduated: number; total: number };
  dueCount: number;
  retentionHealth: number;
  nudge: boolean;
  activeSessionKind: SessionKind | null;
  /** The mastery grid. Keys are fine here: this is a reference view, not a question. */
  tiles: { key: string; name: string; group: string; tile: TileState }[];
  topConfusions: { a: string; b: string; count: number }[];
}

export async function enroll(ctx: ServiceContext): Promise<void> {
  await ctx.store.enroll(ctx.course.slug);
}

export async function getCourseOverview(ctx: ServiceContext): Promise<CourseOverview> {
  const { course, store, now } = ctx;
  const [enrollment, stored, confusions, active] = await Promise.all([
    store.getEnrollment(course.slug),
    store.getPromptStates(course.slug),
    store.getConfusions(course.slug),
    store.getActiveSession(course.slug),
  ]);
  const states = hydrateStates(course, stored);
  const status = enrollment
    ? deriveStatus({
        course,
        states,
        placementCompleted: enrollment.placementCompletedAt !== null,
        passedAt: enrollment.passedAt,
      })
    : null;
  const health = retentionHealth(states, now);
  const byItem = new Map<string, typeof states>();
  for (const s of states) byItem.set(s.itemKey, [...(byItem.get(s.itemKey) ?? []), s]);

  return {
    slug: course.slug,
    title: course.title,
    enrolled: enrollment !== null,
    status,
    passedAt: enrollment?.passedAt ?? null,
    readiness: readiness(course, states),
    dueCount: dueCount(states, now),
    retentionHealth: health,
    nudge: status ? needsReviewNudge(health, status) : false,
    activeSessionKind: active?.kind ?? null,
    tiles: course.items.map((item) => ({
      key: item.key,
      name: item.name,
      group: item.group,
      tile: itemTileState(byItem.get(item.key) ?? []),
    })),
    topConfusions: topConfusions(confusions, 5).map((c) => ({
      a: getItem(course, c.a).name,
      b: getItem(course, c.b).name,
      count: c.count,
    })),
  };
}
