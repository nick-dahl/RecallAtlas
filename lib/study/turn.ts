import type { AnswerGrade, Confusion, QuestionRung, QueueEntry } from '@/lib/engine';
import { SessionConflictError, type AnswerLog, type EnrollmentRecord, type SessionRecord } from '@/lib/db/store';
import type { ServiceContext } from './context';
import { gradeSubmission, issueQuestion } from './issue';
import { toQuestionView } from './present';
import {
  ServiceError,
  type AnswerResponse,
  type FeedbackView,
  type PendingQuestion,
  type QuestionView,
  type SessionKind,
  type SubmissionInput,
} from './types';

/** Answers more than this stale are from a resumed, long-idle question; their timing is noise. */
const RESPONSE_MS_CAP = 5 * 60 * 1000;

/**
 * The course's active session, unless it was saved before the course dropped a prompt type it
 * still refers to (World Map's old "capital" prompt): that one can never be asked or graded, so
 * it is closed and treated as gone.
 */
export async function getLiveSession(ctx: ServiceContext): Promise<SessionRecord | null> {
  const active = await ctx.store.getActiveSession(ctx.course.slug);
  if (!active) return null;
  const known = new Set(ctx.course.promptTypes.map((p) => p.id));
  const state = active.state as { plan?: QueueEntry[]; queue?: QueueEntry[] };
  const entries = [active.pendingQuestion?.entry, ...(state.plan ?? []), ...(state.queue ?? [])];
  if (entries.every((e) => e?.kind !== 'prompt' || known.has(e.promptType))) return active;
  await ctx.store.completeSession(active.id);
  return null;
}

export async function requireEnrollment(ctx: ServiceContext): Promise<EnrollmentRecord> {
  const enrollment = await ctx.store.getEnrollment(ctx.course.slug);
  if (!enrollment) throw new ServiceError('not_enrolled');
  return enrollment;
}

/**
 * Runs a "start a session" attempt, retrying once if it loses a race to create the active
 * session (two concurrent starts both found none active and both tried to create one; the
 * store's unique constraint lets only one through). The retry re-reads state from scratch and
 * will find and resume the winner's session instead of surfacing the race to the caller.
 */
export async function withConflictRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!(err instanceof SessionConflictError)) throw err;
    return fn();
  }
}

/** Loads the active session for a submission and checks it is the question we issued. */
export async function loadTurn(
  ctx: ServiceContext,
  input: SubmissionInput,
  kind: SessionKind,
): Promise<{ active: SessionRecord; pending: PendingQuestion }> {
  const active = await getLiveSession(ctx);
  if (!active || active.id !== input.sessionId || active.kind !== kind) throw new ServiceError('no_active_session');
  const pending = active.pendingQuestion;
  if (!pending || pending.questionId !== input.questionId) throw new ServiceError('stale_question');
  return { active, pending };
}

export function issue(
  ctx: ServiceContext,
  entry: QueueEntry,
  rung: QuestionRung,
  confusions: readonly Confusion[],
): PendingQuestion {
  return issueQuestion({
    entry,
    rung,
    course: ctx.course,
    confusions,
    rng: ctx.rng,
    now: ctx.now,
    newId: ctx.newId,
    maps: ctx.maps,
  });
}

export function gradeAnswer(ctx: ServiceContext, pending: PendingQuestion, response: AnswerResponse): AnswerGrade {
  return gradeSubmission(pending, response, ctx.course, ctx.maps);
}

export function view(
  ctx: ServiceContext,
  pending: PendingQuestion,
  session: { id: string; kind: SessionKind },
  progress: { answered: number; total: number },
): QuestionView {
  return toQuestionView({ pending, session: { ...session, progress }, course: ctx.course, presenter: ctx.presenter });
}

export function answerLog(
  ctx: ServiceContext,
  pending: PendingQuestion,
  response: AnswerResponse,
  grade: AnswerGrade,
  context: SessionKind,
): AnswerLog {
  const { entry } = pending;
  const elapsedMs = ctx.now.getTime() - Date.parse(pending.issuedAt);
  return {
    questionId: pending.questionId,
    context,
    kind: entry.kind === 'contrast' ? 'contrast' : 'prompt',
    itemKey: entry.itemKey,
    promptType: entry.kind === 'prompt' ? entry.promptType : null,
    format: pending.format,
    rung: entry.kind === 'prompt' ? pending.rung : null,
    givenText: response.kind === 'typed' ? response.text : null,
    givenItemKey: grade.correct ? entry.itemKey : grade.answeredItemKey,
    correct: grade.correct,
    responseMs: elapsedMs > RESPONSE_MS_CAP ? null : Math.max(0, elapsedMs),
  };
}

/** Prompt answers that resolve to a different item are confusions; contrast drills never are. */
export function confusionFor(pending: PendingQuestion, grade: AnswerGrade): { asked: string; answered: string } | undefined {
  const { entry } = pending;
  if (entry.kind !== 'prompt' || grade.correct || !grade.answeredItemKey || grade.answeredItemKey === entry.itemKey) {
    return undefined;
  }
  return { asked: entry.itemKey, answered: grade.answeredItemKey };
}

export function feedbackFor(ctx: ServiceContext, pending: PendingQuestion, grade: AnswerGrade): FeedbackView {
  const map = ctx.presenter.feedbackMap?.(pending, grade);
  const answerChoice = pending.choices.find((c) => c.itemKey === pending.entry.itemKey);
  return {
    correct: grade.correct,
    typo: grade.typo,
    ...(answerChoice ? { answerChoiceId: answerChoice.id } : {}),
    answer: ctx.presenter.item(pending.entry.itemKey),
    given: grade.answeredItemKey ? ctx.presenter.item(grade.answeredItemKey) : undefined,
    ...(map ? { map } : {}),
    ...ctx.presenter.feedbackExtra?.(pending, grade),
  };
}
