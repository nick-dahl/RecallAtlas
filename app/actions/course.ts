'use server';

import { getCourse } from '@/lib/content/registry';
import { SessionConflictError, StaleSessionError } from '@/lib/db/store';
import { createServiceContext } from '@/lib/server/context';
import type { ServiceContext } from '@/lib/study/context';
import { abandonExam, startExam, submitExamAnswer } from '@/lib/study/exam-service';
import { enroll, getCourseOverview, type CourseOverview } from '@/lib/study/overview-service';
import { skipPlacement, startPlacement, submitPlacementAnswer } from '@/lib/study/placement-service';
import { endStudy, startStudy, submitStudyAnswer } from '@/lib/study/study-service';
import { ServiceError, type ServiceErrorCode, type TurnResult } from '@/lib/study/types';
import { parseStudyOptions, parseSubmission } from '@/lib/study/validate';
import { getUserId } from '@/lib/supabase/server';

export type ActionError = ServiceErrorCode | 'unauthorized' | 'unknown_course' | 'stale_session';
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

async function run<T>(slug: string, fn: (ctx: ServiceContext) => Promise<T>): Promise<ActionResult<T>> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: 'unauthorized' };
  const course = getCourse(slug);
  if (!course) return { ok: false, error: 'unknown_course' };
  try {
    return { ok: true, data: await fn(createServiceContext(userId, course)) };
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, error: error.code };
    if (error instanceof StaleSessionError || error instanceof SessionConflictError) {
      return { ok: false, error: 'stale_session' };
    }
    throw error;
  }
}

export async function enrollAction(slug: string): Promise<ActionResult<void>> {
  return run(slug, enroll);
}
export async function overviewAction(slug: string): Promise<ActionResult<CourseOverview>> {
  return run(slug, getCourseOverview);
}

export async function startPlacementAction(slug: string): Promise<ActionResult<TurnResult>> {
  return run(slug, startPlacement);
}
export async function submitPlacementAction(slug: string, input: unknown): Promise<ActionResult<TurnResult>> {
  return run(slug, (ctx) => submitPlacementAnswer(ctx, parseSubmission(input)));
}
export async function skipPlacementAction(slug: string): Promise<ActionResult<void>> {
  return run(slug, skipPlacement);
}

export async function startStudyAction(slug: string, options?: unknown): Promise<ActionResult<TurnResult>> {
  return run(slug, (ctx) => startStudy(ctx, parseStudyOptions(options)));
}
export async function submitStudyAction(slug: string, input: unknown): Promise<ActionResult<TurnResult>> {
  return run(slug, (ctx) => submitStudyAnswer(ctx, parseSubmission(input)));
}
export async function endStudyAction(slug: string): Promise<ActionResult<void>> {
  return run(slug, endStudy);
}

export async function startExamAction(slug: string): Promise<ActionResult<TurnResult>> {
  return run(slug, startExam);
}
export async function submitExamAction(slug: string, input: unknown): Promise<ActionResult<TurnResult>> {
  return run(slug, (ctx) => submitExamAnswer(ctx, parseSubmission(input)));
}
export async function abandonExamAction(slug: string): Promise<ActionResult<void>> {
  return run(slug, abandonExam);
}
