import {
  advance,
  applyExamAnswer,
  buildExamQueue,
  currentEntry,
  hydrateStates,
  isExamReady,
  scoreExam,
  stateKey,
  type QueueSession,
} from '@/lib/engine';
import type { ServiceContext } from './context';
import { answerLog, confusionFor, gradeAnswer, issue, loadTurn, requireEnrollment, view, withConflictRetry } from './turn';
import { ServiceError, type EndView, type SubmissionInput, type TurnResult } from './types';

export interface ExamState extends QueueSession {
  results: { itemKey: string; correct: boolean }[];
}

const progressOf = (s: QueueSession) => ({ answered: s.position, total: s.queue.length });

/** Starts the final exam (gated by readiness, checked only here), or resumes it. */
export async function startExam(ctx: ServiceContext): Promise<TurnResult> {
  return withConflictRetry(() => startExamAttempt(ctx));
}

async function startExamAttempt(ctx: ServiceContext): Promise<TurnResult> {
  const { store, course, rng } = ctx;
  await requireEnrollment(ctx);
  let active = await store.getActiveSession(course.slug);
  if (active?.kind === 'exam' && active.pendingQuestion) {
    return { next: view(ctx, active.pendingQuestion, active, progressOf(active.state as ExamState)) };
  }
  // A dead-end exam session (no pending question, e.g. left over from a crash) can never be
  // resumed above; clear it before the readiness check so it can't block study or a retry
  // forever, regardless of whether the course turns out to be exam-ready right now.
  if (active?.kind === 'exam' && !active.pendingQuestion) {
    await store.completeSession(active.id);
    active = null;
  }

  const [stored, confusions] = await Promise.all([store.getPromptStates(course.slug), store.getConfusions(course.slug)]);
  if (!isExamReady(course, hydrateStates(course, stored))) throw new ServiceError('exam_not_ready');
  if (active) await store.completeSession(active.id);

  const queue = buildExamQueue(course, rng);
  const state: ExamState = { ...queue, results: [] };
  // Exams are always asked at Recall (rung 3), never via rungForState.
  const pending = issue(ctx, currentEntry(queue)!, 3, confusions);
  const session = await store.createSession({ courseSlug: course.slug, kind: 'exam', state, pendingQuestion: pending });
  return { next: view(ctx, pending, session, progressOf(state)) };
}

/** No per-question feedback during the exam; the result arrives with the last answer. */
export async function submitExamAnswer(ctx: ServiceContext, input: SubmissionInput): Promise<TurnResult> {
  const { store, course, now, presenter } = ctx;
  const { active, pending } = await loadTurn(ctx, input, 'exam');
  const { entry } = pending;
  if (entry.kind !== 'prompt') throw new ServiceError('invalid_response');

  const grade = gradeAnswer(ctx, pending, input.response);
  const [stored, confusions] = await Promise.all([store.getPromptStates(course.slug), store.getConfusions(course.slug)]);
  const states = hydrateStates(course, stored);
  const key = stateKey(entry.itemKey, entry.promptType);
  const updated = applyExamAnswer(states.find((s) => stateKey(s.itemKey, s.promptType) === key)!, grade, now);

  const previous = active.state as ExamState;
  const state: ExamState = {
    ...advance(previous),
    results: [...previous.results, { itemKey: entry.itemKey, correct: grade.correct }],
  };
  const nextEntry = currentEntry(state);
  const nextPending = nextEntry ? issue(ctx, nextEntry, 3, confusions) : null;

  let end: EndView | undefined;
  let examAttempt;
  let enrollment;
  if (!nextPending) {
    const result = scoreExam(state.results, course.items.length);
    examAttempt = { score: result.score, total: result.total, passed: result.passed, missedItemKeys: result.missed };
    if (result.passed) enrollment = { passedAt: now };
    end = {
      reason: 'exam_finished',
      examResult: { score: result.score, total: result.total, passed: result.passed, missed: result.missed.map(presenter.item) },
    };
  }

  await store.commitTurn(course.slug, {
    sessionId: active.id,
    expectedVersion: active.version,
    sessionState: state,
    pendingQuestion: nextPending,
    completed: nextPending === null,
    promptStates: [updated],
    answer: answerLog(ctx, pending, input.response, grade, 'exam'),
    confusion: confusionFor(pending, grade),
    enrollment,
    examAttempt,
  });

  return { next: nextPending ? view(ctx, nextPending, active, progressOf(state)) : null, end };
}

/** Voids the attempt; FSRS updates already made stand. */
export async function abandonExam(ctx: ServiceContext): Promise<void> {
  const active = await ctx.store.getActiveSession(ctx.course.slug);
  if (active?.kind === 'exam') await ctx.store.completeSession(active.id);
}
