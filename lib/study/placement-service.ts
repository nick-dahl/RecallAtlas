import {
  advance,
  applyPlacementAnswer,
  buildPlacementQueue,
  currentEntry,
  hydrateStates,
  type QueueSession,
} from '@/lib/engine';
import type { ServiceContext } from './context';
import { gradeSubmission } from './issue';
import { answerLog, confusionFor, feedbackFor, issue, loadTurn, requireEnrollment, view, withConflictRetry } from './turn';
import { ServiceError, type SubmissionInput, type TurnResult } from './types';

const progressOf = (q: QueueSession) => ({ answered: q.position, total: q.queue.length });

/** Starts the placement sweep, or resumes the one in progress. */
export async function startPlacement(ctx: ServiceContext): Promise<TurnResult> {
  return withConflictRetry(() => startPlacementAttempt(ctx));
}

async function startPlacementAttempt(ctx: ServiceContext): Promise<TurnResult> {
  const { store, course, now } = ctx;
  const enrollment = await requireEnrollment(ctx);
  if (enrollment.placementCompletedAt) throw new ServiceError('placement_done');

  const active = await store.getActiveSession(course.slug);
  if (active?.kind === 'placement' && active.pendingQuestion) {
    return { next: view(ctx, active.pendingQuestion, active, progressOf(active.state as QueueSession)) };
  }
  if (active?.kind === 'exam') throw new ServiceError('exam_in_progress');
  if (active) await store.completeSession(active.id);

  const states = hydrateStates(course, await store.getPromptStates(course.slug));
  const queue = buildPlacementQueue(course, states);
  const entry = currentEntry(queue);
  if (!entry) {
    await store.setPlacementCompleted(course.slug, now);
    return { next: null, end: { reason: 'placement_complete' } };
  }
  const pending = issue(ctx, entry, 3, []);
  const session = await store.createSession({ courseSlug: course.slug, kind: 'placement', state: queue, pendingQuestion: pending });
  return { next: view(ctx, pending, session, progressOf(queue)) };
}

export async function submitPlacementAnswer(ctx: ServiceContext, input: SubmissionInput): Promise<TurnResult> {
  const { store, course, now } = ctx;
  const { active, pending } = await loadTurn(ctx, input, 'placement');
  const { entry } = pending;
  if (entry.kind !== 'prompt') throw new ServiceError('invalid_response');

  const grade = gradeSubmission(pending, input.response, course);
  const states = hydrateStates(course, await store.getPromptStates(course.slug));
  const updated = applyPlacementAnswer({ states, itemKey: entry.itemKey, correct: grade.correct, now });
  const queue = advance(active.state as QueueSession);
  const nextEntry = currentEntry(queue);
  const nextPending = nextEntry ? issue(ctx, nextEntry, 3, []) : null;
  const completed = nextPending === null;

  await store.commitTurn(course.slug, {
    sessionId: active.id,
    expectedVersion: active.version,
    sessionState: queue,
    pendingQuestion: nextPending,
    completed,
    promptStates: grade.correct ? updated.filter((s) => s.itemKey === entry.itemKey) : [],
    answer: answerLog(ctx, pending, input.response, grade, 'placement'),
    confusion: confusionFor(pending, grade),
    enrollment: completed ? { placementCompletedAt: now } : undefined,
  });

  return {
    feedback: feedbackFor(ctx, pending, grade),
    next: nextPending ? view(ctx, nextPending, active, progressOf(queue)) : null,
    end: completed ? { reason: 'placement_complete' } : undefined,
  };
}

/** Marks placement done without (finishing) the sweep. */
export async function skipPlacement(ctx: ServiceContext): Promise<void> {
  const { store, course, now } = ctx;
  await requireEnrollment(ctx);
  const active = await store.getActiveSession(course.slug);
  if (active?.kind === 'placement') await store.completeSession(active.id);
  await store.setPlacementCompleted(course.slug, now);
}
