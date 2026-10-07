import {
  ENGINE_CONFIG,
  applyContrast,
  applyIntro,
  applyStudyAnswer,
  hydrateStates,
  newItemsInOrder,
  nextEntry,
  planPractice,
  rungForState,
  startStudySession,
  stateKey,
  type Confusion,
  type PromptState,
  type StudyMode,
  type StudySession,
} from '@/lib/engine';
import type { ServiceContext } from './context';
import {
  answerLog,
  confusionFor,
  feedbackFor,
  getLiveSession,
  gradeAnswer,
  issue,
  loadTurn,
  requireEnrollment,
  view,
  withConflictRetry,
} from './turn';
import {
  ServiceError,
  type EndReason,
  type EndView,
  type FeedbackView,
  type PendingQuestion,
  type SubmissionInput,
  type TurnResult,
} from './types';

export const STUDY_SESSION_STALE_MS = 24 * 60 * 60 * 1000;

const progressOf = (s: StudySession) => ({ answered: s.answered, total: s.size });

function issueNext(
  ctx: ServiceContext,
  states: PromptState[],
  session: StudySession,
  confusions: readonly Confusion[],
): PendingQuestion | null {
  const entry = nextEntry({ course: ctx.course, states, session, now: ctx.now });
  if (!entry) return null;
  if (entry.kind !== 'prompt') return issue(ctx, entry, 1, confusions);
  const state = states.find((s) => s.itemKey === entry.itemKey && s.promptType === entry.promptType)!;
  return issue(ctx, entry, rungForState(state), confusions);
}

function endReason(ctx: ServiceContext, states: PromptState[], session: StudySession): EndReason {
  if (session.plan) return session.plan.length === 0 ? 'nothing_to_practice' : 'practice_complete';
  if (session.answered >= session.size) return 'complete';
  if (states.some((s) => s.phase === 'learning')) return 'come_back_later';
  if (newItemsInOrder(ctx.course, states).length > 0) return 'more_new_available';
  return 'caught_up';
}

function endView(ctx: ServiceContext, states: PromptState[], session: StudySession): EndView {
  const reason = endReason(ctx, states, session);
  if (reason !== 'practice_complete') return { reason };
  // Each planned prompt is asked once, so every miss recorded this session is one slipped item.
  const missed = Object.values(session.lastMissed).filter(Boolean).length;
  return { reason, practiceResult: { checked: session.answered, remembered: session.answered - missed } };
}

/** Starts a study session, or resumes a recent one in the same mode. */
export async function startStudy(
  ctx: ServiceContext,
  opts: { mode?: StudyMode; size?: number } = {},
): Promise<TurnResult> {
  return withConflictRetry(() => startStudyAttempt(ctx, opts));
}

async function startStudyAttempt(ctx: ServiceContext, opts: { mode?: StudyMode; size?: number }): Promise<TurnResult> {
  const { store, course, now } = ctx;
  const enrollment = await requireEnrollment(ctx);
  if (!enrollment.placementCompletedAt) throw new ServiceError('placement_pending');

  const mode = opts.mode ?? 'normal';
  const active = await getLiveSession(ctx);
  if (active?.kind === 'exam') throw new ServiceError('exam_in_progress');
  if (
    active?.kind === 'study' &&
    active.pendingQuestion &&
    (active.state as StudySession).mode === mode &&
    now.getTime() - active.updatedAt.getTime() < STUDY_SESSION_STALE_MS
  ) {
    return { next: view(ctx, active.pendingQuestion, active, progressOf(active.state as StudySession)) };
  }
  if (active) await store.completeSession(active.id);

  const [stored, confusions] = await Promise.all([store.getPromptStates(course.slug), store.getConfusions(course.slug)]);
  const states = hydrateStates(course, stored);
  const size = opts.size ?? ENGINE_CONFIG.sessionSize;
  const session =
    mode === 'practice-ahead'
      ? startStudySession({ mode, size, plan: planPractice(states, now, size, ctx.rng) })
      : startStudySession({ mode, size });
  const pending = issueNext(ctx, states, session, confusions);
  if (!pending) return { next: null, end: endView(ctx, states, session) };

  const record = await store.createSession({ courseSlug: course.slug, kind: 'study', state: session, pendingQuestion: pending });
  return { next: view(ctx, pending, record, progressOf(session)) };
}

export async function submitStudyAnswer(ctx: ServiceContext, input: SubmissionInput): Promise<TurnResult> {
  const { store, course, now } = ctx;
  const { active, pending } = await loadTurn(ctx, input, 'study');
  const [stored, storedConfusions] = await Promise.all([
    store.getPromptStates(course.slug),
    store.getConfusions(course.slug),
  ]);
  let states = hydrateStates(course, stored);
  let session = active.state as StudySession;
  let confusions: Confusion[] = storedConfusions;
  let changed: PromptState[] = [];
  let feedback: FeedbackView | undefined;
  let answer;
  let confusion;
  const { entry } = pending;

  if (entry.kind === 'intro') {
    if (input.response.kind !== 'ack') throw new ServiceError('invalid_response');
    const result = applyIntro({ session, itemKey: entry.itemKey, states });
    session = result.session;
    states = result.states;
    changed = states.filter((s) => s.itemKey === entry.itemKey);
  } else if (entry.kind === 'contrast') {
    const grade = gradeAnswer(ctx, pending, input.response);
    session = applyContrast(session);
    answer = answerLog(ctx, pending, input.response, grade, 'study');
    feedback = feedbackFor(ctx, pending, grade);
  } else {
    const grade = gradeAnswer(ctx, pending, input.response);
    const key = stateKey(entry.itemKey, entry.promptType);
    const current = states.find((s) => stateKey(s.itemKey, s.promptType) === key)!;
    const result = applyStudyAnswer({ session, state: current, confusions, grade, now });
    session = result.session;
    confusions = result.confusions;
    states = states.map((s) => (stateKey(s.itemKey, s.promptType) === key ? result.state : s));
    changed = [result.state];
    answer = answerLog(ctx, pending, input.response, grade, 'study');
    confusion = confusionFor(pending, grade);
    feedback = { ...feedbackFor(ctx, pending, grade), outcome: result.outcome, contrastQueued: result.contrastQueued };
  }

  const nextPending = issueNext(ctx, states, session, confusions);
  const completed = nextPending === null;
  await store.commitTurn(course.slug, {
    sessionId: active.id,
    expectedVersion: active.version,
    sessionState: session,
    pendingQuestion: nextPending,
    completed,
    promptStates: changed,
    answer,
    confusion,
  });

  return {
    feedback,
    next: nextPending ? view(ctx, nextPending, active, progressOf(session)) : null,
    end: completed ? endView(ctx, states, session) : undefined,
  };
}

/** Ends the active study session early. Progress already committed is kept. */
export async function endStudy(ctx: ServiceContext): Promise<void> {
  const active = await ctx.store.getActiveSession(ctx.course.slug);
  if (active?.kind === 'study') await ctx.store.completeSession(active.id);
}
