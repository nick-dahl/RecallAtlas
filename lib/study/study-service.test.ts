import { describe, expect, it } from 'vitest';
import { days, TEST_COURSE } from '@/lib/engine/test-fixtures';
import { endStudy, startStudy, submitStudyAnswer } from './study-service';
import { allGraduated, correctResponse, enrolledStore, pendingFor, testContext, wrongChoice } from './test-helpers';
import { ServiceError, type TurnResult } from './types';

const SLUG = TEST_COURSE.slug;

async function answer(ctx: ReturnType<typeof testContext>, turn: TurnResult, response: Parameters<typeof submitStudyAnswer>[1]['response']) {
  return submitStudyAnswer(ctx, { sessionId: turn.next!.sessionId, questionId: turn.next!.questionId, response });
}

describe('startStudy', () => {
  it('requires placement to be completed or skipped', async () => {
    const { store } = await enrolledStore();
    await expect(startStudy(testContext(store))).rejects.toEqual(new ServiceError('placement_pending'));
  });

  it('opens with an intro card for the first item and resumes the same question', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    const ctx = testContext(store);
    const first = await startStudy(ctx);
    expect(first.next).toMatchObject({ sessionKind: 'study', format: 'intro', prompt: { name: 'United States' } });
    expect((await startStudy(ctx)).next!.questionId).toBe(first.next!.questionId);
  });

  it('replaces a study session idle for more than 24 hours', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    const first = await startStudy(testContext(store));
    store.backdateActiveSession(SLUG, days(-2));
    const fresh = await startStudy(testContext(store));
    expect(fresh.next!.sessionId).not.toBe(first.next!.sessionId);
  });

  it('is blocked while an exam is in progress', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    await store.createSession({ courseSlug: SLUG, kind: 'exam', state: {}, pendingQuestion: null });
    await expect(startStudy(testContext(store))).rejects.toEqual(new ServiceError('exam_in_progress'));
  });

  it('resolves two concurrent starts to the same session instead of crashing', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    const ctx = testContext(store);
    const [a, b] = await Promise.all([startStudy(ctx), startStudy(ctx)]);
    expect(a.next!.questionId).toBe(b.next!.questionId);
  });

  it('ends immediately with caught_up when everything is graduated and nothing is due', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    store.seedPromptStates(SLUG, allGraduated());
    expect(await startStudy(testContext(store))).toEqual({ next: null, end: { reason: 'caught_up' } });
  });
});

describe('submitStudyAnswer', () => {
  it('runs a full session for a perfect learner and logs every graded answer', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    const ctx = testContext(store);
    let turn = await startStudy(ctx);
    let graded = 0;
    while (turn.next) {
      const pending = await pendingFor(store);
      if (pending.entry.kind === 'prompt') graded++;
      turn = await answer(ctx, turn, correctResponse(pending));
    }
    expect(turn.end).toEqual({ reason: 'complete' });
    expect(graded).toBe(20);
    expect(store.answers.filter((a) => a.context === 'study')).toHaveLength(20);
    const states = await store.getPromptStates(SLUG);
    expect(states.some((s) => s.phase === 'learning' || s.phase === 'review')).toBe(true);
    expect(await store.getActiveSession(SLUG)).toBeNull();
  });

  it('acknowledges intros without logging an answer', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    const ctx = testContext(store);
    const turn = await startStudy(ctx);
    const result = await answer(ctx, turn, { kind: 'ack' });
    expect(result.feedback).toBeUndefined();
    expect(store.answers).toHaveLength(0);
    expect((await store.getPromptStates(SLUG)).filter((s) => s.itemKey === 'US' && s.phase === 'learning')).toHaveLength(2);
  });

  it('reports feedback and queues a contrast drill when a confusion repeats', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    for (const other of TEST_COURSE.items) {
      if (other.key !== 'US') store.seedConfusion(SLUG, 'US', other.key, 1);
    }
    const ctx = testContext(store);
    let turn = await startStudy(ctx);
    let pending = await pendingFor(store);
    while (!(pending.entry.kind === 'prompt' && pending.entry.itemKey === 'US')) {
      turn = await answer(ctx, turn, correctResponse(pending));
      pending = await pendingFor(store);
    }
    const wrong = wrongChoice(pending);
    const result = await answer(ctx, turn, { kind: 'choice', choiceId: wrong.choiceId });
    expect(result.feedback).toMatchObject({ correct: false, answer: { name: 'United States' }, outcome: 'dropped', contrastQueued: true });
    expect(result.next).toMatchObject({ format: 'contrast', prompt: { name: 'United States' } });
    expect(result.next!.pair).toHaveLength(2);

    const drill = await pendingFor(store);
    const after = await answer(ctx, result, correctResponse(drill));
    expect(after.feedback).toMatchObject({ correct: true });
    expect(store.answers.at(-1)).toMatchObject({ kind: 'contrast', context: 'study' });
  });

  it('rejects invalid responses and stale questions', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    const ctx = testContext(store);
    const turn = await startStudy(ctx);
    await expect(answer(ctx, turn, { kind: 'dont-know' })).rejects.toEqual(new ServiceError('invalid_response'));
    await answer(ctx, turn, { kind: 'ack' });
    await expect(answer(ctx, turn, { kind: 'ack' })).rejects.toEqual(new ServiceError('stale_question'));
  });
});

describe('endStudy', () => {
  it('closes the active study session', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    const ctx = testContext(store);
    await startStudy(ctx);
    await endStudy(ctx);
    expect(await store.getActiveSession(SLUG)).toBeNull();
  });
});
