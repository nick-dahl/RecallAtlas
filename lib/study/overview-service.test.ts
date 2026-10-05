import { describe, expect, it } from 'vitest';
import { MemoryStore } from '@/lib/db/memory-store';
import { days, NOW, TEST_COURSE } from '@/lib/engine/test-fixtures';
import { startExam, submitExamAnswer } from './exam-service';
import { enroll, getCourseOverview } from './overview-service';
import { allGraduated, correctResponse, enrolledStore, pendingFor, testContext } from './test-helpers';

describe('getCourseOverview', () => {
  it('reports an unenrolled course', async () => {
    const overview = await getCourseOverview(testContext(new MemoryStore()));
    expect(overview).toMatchObject({ slug: TEST_COURSE.slug, enrolled: false, status: null, nudge: false });
  });

  it('reports a fresh enrollment as placement with nothing graduated', async () => {
    const { store } = await enrolledStore();
    const overview = await getCourseOverview(testContext(store));
    expect(overview).toMatchObject({
      enrolled: true,
      status: 'placement',
      readiness: { graduated: 0, total: 34 },
      dueCount: 0,
      activeSessionKind: null,
      nudge: false,
    });
    expect(overview.tiles).toHaveLength(17);
    expect(overview.tiles.every((t) => t.tile === 'new')).toBe(true);
    expect(overview.tiles[0].prompts).toEqual([
      { label: 'Flag → Name', phase: 'new' },
      { label: 'Name → Flag', phase: 'new' },
    ]);
  });

  it('reports each prompt’s phase on the tile (for the mastery map’s summary)', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    store.seedPromptStates(TEST_COURSE.slug, allGraduated().filter((s) => s.itemKey === 'US' && s.promptType === 'flag_to_name'));
    const us = (await getCourseOverview(testContext(store))).tiles.find((t) => t.key === 'US')!;
    expect(us.prompts.map((p) => p.phase)).toEqual(['review', 'new']);
  });

  it('reports exam_ready, then passed with a retention nudge once memory fades', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    store.seedPromptStates(TEST_COURSE.slug, allGraduated());
    expect((await getCourseOverview(testContext(store))).status).toBe('exam_ready');

    const session = await store.createSession({ courseSlug: TEST_COURSE.slug, kind: 'exam', state: {}, pendingQuestion: null });
    await store.commitTurn(TEST_COURSE.slug, {
      sessionId: session.id,
      expectedVersion: 0,
      sessionState: {},
      pendingQuestion: null,
      completed: true,
      promptStates: [],
      enrollment: { passedAt: NOW },
    });
    const later = await getCourseOverview(testContext(store, { now: days(90) }));
    expect(later).toMatchObject({ status: 'passed', nudge: true });
    expect(later.retentionHealth).toBeLessThan(0.9);
    expect(later.dueCount).toBe(34);
  });

  it('names the top confusions', async () => {
    const { store } = await enrolledStore();
    store.seedConfusion(TEST_COURSE.slug, 'TD', 'RO', 3);
    const overview = await getCourseOverview(testContext(store));
    expect(overview.topConfusions).toEqual([{ a: 'Romania', b: 'Chad', count: 3 }]);
  });
});

describe('lastExamAttempt', () => {
  it('is null before any attempt, and reflects the most recent attempt afterwards', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    store.seedPromptStates(TEST_COURSE.slug, allGraduated());
    const ctx = testContext(store);
    expect((await getCourseOverview(ctx)).lastExamAttempt).toBeNull();

    let turn = await startExam(ctx);
    while (turn.next) {
      const pending = await pendingFor(store);
      const response = pending.entry.itemKey === 'TD' ? { kind: 'dont-know' as const } : correctResponse(pending);
      turn = await submitExamAnswer(ctx, { sessionId: turn.next.sessionId, questionId: turn.next.questionId, response });
    }

    const overview = await getCourseOverview(ctx);
    expect(overview.lastExamAttempt).toMatchObject({ score: 16, total: 17, passed: false, missed: [{ name: 'Chad' }] });
    expect(overview.lastExamAttempt!.finishedAt).toBeInstanceOf(Date);
  });
});

describe('enroll', () => {
  it('is idempotent', async () => {
    const ctx = testContext(new MemoryStore());
    await enroll(ctx);
    await enroll(ctx);
    expect((await getCourseOverview(ctx)).enrolled).toBe(true);
  });
});
