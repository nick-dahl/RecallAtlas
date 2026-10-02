import { describe, expect, it } from 'vitest';
import { TEST_COURSE } from '@/lib/engine/test-fixtures';
import { abandonExam, startExam, submitExamAnswer } from './exam-service';
import { startStudy } from './study-service';
import { allGraduated, correctResponse, enrolledStore, pendingFor, testContext } from './test-helpers';
import { ServiceError, type TurnResult } from './types';

const SLUG = TEST_COURSE.slug;

async function readyStore() {
  const { store } = await enrolledStore({ placementDone: true });
  store.seedPromptStates(SLUG, allGraduated());
  return store;
}

async function runExam(store: Awaited<ReturnType<typeof readyStore>>, missKey?: string): Promise<TurnResult> {
  const ctx = testContext(store);
  let turn = await startExam(ctx);
  while (turn.next) {
    const pending = await pendingFor(store);
    const response = pending.entry.itemKey === missKey ? { kind: 'dont-know' as const } : correctResponse(pending);
    turn = await submitExamAnswer(ctx, { sessionId: turn.next.sessionId, questionId: turn.next.questionId, response });
    expect(turn.feedback).toBeUndefined();
  }
  return turn;
}

describe('exam', () => {
  it('is locked until every prompt is graduated', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    await expect(startExam(testContext(store))).rejects.toEqual(new ServiceError('exam_not_ready'));
  });

  it('asks every item once at Recall and resumes the same question', async () => {
    const store = await readyStore();
    const ctx = testContext(store);
    const first = await startExam(ctx);
    expect(first.next).toMatchObject({ sessionKind: 'exam', progress: { answered: 0, total: 17 } });
    expect(['typed', 'flag-grid']).toContain(first.next!.format);
    expect((await startExam(ctx)).next!.questionId).toBe(first.next!.questionId);
  });

  it('passes at 100%, recording the attempt and the pass date', async () => {
    const store = await readyStore();
    const end = await runExam(store);
    expect(end.end).toMatchObject({ reason: 'exam_finished', examResult: { score: 17, total: 17, passed: true, missed: [] } });
    expect((await store.getEnrollment(SLUG))!.passedAt).not.toBeNull();
    expect(await store.getExamAttempts(SLUG)).toHaveLength(1);
    expect(store.answers.filter((a) => a.context === 'exam')).toHaveLength(17);
  });

  it('fails on a single miss, lapsing that prompt and naming it', async () => {
    const store = await readyStore();
    const end = await runExam(store, 'TD');
    expect(end.end).toMatchObject({
      reason: 'exam_finished',
      examResult: { score: 16, total: 17, passed: false, missed: [{ name: 'Chad' }] },
    });
    expect((await store.getEnrollment(SLUG))!.passedAt).toBeNull();
    expect((await store.getPromptStates(SLUG)).some((s) => s.itemKey === 'TD' && s.phase === 'learning')).toBe(true);
    await expect(startExam(testContext(store))).rejects.toEqual(new ServiceError('exam_not_ready'));
  });

  it('clears a dead-end active exam session (no pending question) and starts fresh', async () => {
    const store = await readyStore();
    await store.createSession({ courseSlug: SLUG, kind: 'exam', state: {}, pendingQuestion: null });
    const ctx = testContext(store);
    const result = await startExam(ctx);
    expect(result.next).toMatchObject({ sessionKind: 'exam' });
    expect((await store.getActiveSession(SLUG))!.pendingQuestion).not.toBeNull();
  });

  it('clears a dead-end exam session even when not exam-ready, so it does not block forever', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    await store.createSession({ courseSlug: SLUG, kind: 'exam', state: {}, pendingQuestion: null });
    const ctx = testContext(store);
    await expect(startExam(ctx)).rejects.toEqual(new ServiceError('exam_not_ready'));
    expect(await store.getActiveSession(SLUG)).toBeNull();
  });

  it('resolves two concurrent starts to the same exam session instead of crashing', async () => {
    const store = await readyStore();
    const ctx = testContext(store);
    const [a, b] = await Promise.all([startExam(ctx), startExam(ctx)]);
    expect(a.next!.questionId).toBe(b.next!.questionId);
  });

  it('abandons a study session when the exam starts, and blocks study during the exam', async () => {
    const store = await readyStore();
    const ctx = testContext(store);
    await store.createSession({ courseSlug: SLUG, kind: 'study', state: {}, pendingQuestion: null });
    await startExam(ctx);
    expect((await store.getActiveSession(SLUG))!.kind).toBe('exam');
    await expect(startStudy(ctx)).rejects.toEqual(new ServiceError('exam_in_progress'));
  });

  it('can be abandoned without recording an attempt', async () => {
    const store = await readyStore();
    const ctx = testContext(store);
    await startExam(ctx);
    await abandonExam(ctx);
    expect(await store.getActiveSession(SLUG)).toBeNull();
    expect(await store.getExamAttempts(SLUG)).toHaveLength(0);
  });
});
