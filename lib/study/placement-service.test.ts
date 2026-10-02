import { describe, expect, it } from 'vitest';
import { MemoryStore } from '@/lib/db/memory-store';
import { TEST_COURSE } from '@/lib/engine/test-fixtures';
import { skipPlacement, startPlacement, submitPlacementAnswer } from './placement-service';
import { correctResponse, enrolledStore, pendingFor, testContext } from './test-helpers';
import { ServiceError } from './types';

const SLUG = TEST_COURSE.slug;

describe('placement', () => {
  it('requires enrollment', async () => {
    await expect(startPlacement(testContext(new MemoryStore()))).rejects.toEqual(new ServiceError('not_enrolled'));
  });

  it('asks a typed Flag → Name question for the first item and resumes the same question', async () => {
    const { store } = await enrolledStore();
    const ctx = testContext(store);
    const first = await startPlacement(ctx);
    expect(first.next).toMatchObject({ sessionKind: 'placement', format: 'typed', progress: { answered: 0, total: 17 } });
    expect(first.next!.prompt.flag).toBeDefined();
    expect((await pendingFor(store)).entry.itemKey).toBe('US');
    const again = await startPlacement(ctx);
    expect(again.next!.questionId).toBe(first.next!.questionId);
  });

  it('fast-tracks a correctly named item and moves on', async () => {
    const { store } = await enrolledStore();
    const ctx = testContext(store);
    const { next } = await startPlacement(ctx);
    const result = await submitPlacementAnswer(ctx, {
      sessionId: next!.sessionId,
      questionId: next!.questionId,
      response: { kind: 'typed', text: 'United States' },
    });
    expect(result.feedback).toMatchObject({ correct: true, answer: { name: 'United States' } });
    expect(result.next!.progress).toEqual({ answered: 1, total: 17 });
    const us = (await store.getPromptStates(SLUG)).filter((s) => s.itemKey === 'US');
    expect(us).toHaveLength(2);
    expect(us.every((s) => s.phase === 'review')).toBe(true);
    expect(store.answers).toHaveLength(1);
    expect(store.answers[0]).toMatchObject({ context: 'placement', correct: true, itemKey: 'US' });
  });

  it('records a confusion and leaves the item new on a wrong answer', async () => {
    const { store } = await enrolledStore();
    const ctx = testContext(store);
    let turn = await startPlacement(ctx);
    turn = await submitPlacementAnswer(ctx, {
      sessionId: turn.next!.sessionId,
      questionId: turn.next!.questionId,
      response: { kind: 'typed', text: 'United States' },
    });
    expect((await pendingFor(store)).entry.itemKey).toBe('EC');
    const wrong = await submitPlacementAnswer(ctx, {
      sessionId: turn.next!.sessionId,
      questionId: turn.next!.questionId,
      response: { kind: 'typed', text: 'Colombia' },
    });
    expect(wrong.feedback).toMatchObject({ correct: false, given: { name: 'Colombia' } });
    expect(await store.getConfusions(SLUG)).toEqual([{ asked: 'EC', answered: 'CO', count: 1 }]);
    expect((await store.getPromptStates(SLUG)).some((s) => s.itemKey === 'EC')).toBe(false);
  });

  it('completes placement after the last item', async () => {
    const { store } = await enrolledStore();
    const ctx = testContext(store);
    let turn = await startPlacement(ctx);
    while (turn.next) {
      const pending = await pendingFor(store);
      turn = await submitPlacementAnswer(ctx, {
        sessionId: turn.next.sessionId,
        questionId: turn.next.questionId,
        response: correctResponse(pending),
      });
    }
    expect(turn.end).toEqual({ reason: 'placement_complete' });
    expect((await store.getEnrollment(SLUG))!.placementCompletedAt).not.toBeNull();
    expect(await store.getActiveSession(SLUG)).toBeNull();
    await expect(startPlacement(ctx)).rejects.toEqual(new ServiceError('placement_done'));
  });

  it('rejects a stale question id', async () => {
    const { store } = await enrolledStore();
    const ctx = testContext(store);
    const { next } = await startPlacement(ctx);
    const input = { sessionId: next!.sessionId, questionId: next!.questionId, response: { kind: 'dont-know' as const } };
    await submitPlacementAnswer(ctx, input);
    await expect(submitPlacementAnswer(ctx, input)).rejects.toEqual(new ServiceError('stale_question'));
  });

  it('can be skipped, closing any open placement session', async () => {
    const { store } = await enrolledStore();
    const ctx = testContext(store);
    await startPlacement(ctx);
    await skipPlacement(ctx);
    expect((await store.getEnrollment(SLUG))!.placementCompletedAt).not.toBeNull();
    expect(await store.getActiveSession(SLUG)).toBeNull();
  });
});
