import type { AnswerGrade, Confusion, QuestionRung, QueueEntry } from '@/lib/engine';
import type { AnswerLog, EnrollmentRecord, SessionRecord } from '@/lib/db/store';
import type { ServiceContext } from './context';
import { issueQuestion } from './issue';
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

export async function requireEnrollment(ctx: ServiceContext): Promise<EnrollmentRecord> {
  const enrollment = await ctx.store.getEnrollment(ctx.course.slug);
  if (!enrollment) throw new ServiceError('not_enrolled');
  return enrollment;
}

/** Loads the active session for a submission and checks it is the question we issued. */
export async function loadTurn(
  ctx: ServiceContext,
  input: SubmissionInput,
  kind: SessionKind,
): Promise<{ active: SessionRecord; pending: PendingQuestion }> {
  const active = await ctx.store.getActiveSession(ctx.course.slug);
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
  return issueQuestion({ entry, rung, course: ctx.course, confusions, rng: ctx.rng, now: ctx.now, newId: ctx.newId });
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
    responseMs: Math.max(0, ctx.now.getTime() - Date.parse(pending.issuedAt)),
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
  return {
    correct: grade.correct,
    typo: grade.typo,
    answer: ctx.presenter.item(pending.entry.itemKey),
    given: grade.answeredItemKey ? ctx.presenter.item(grade.answeredItemKey) : undefined,
  };
}
