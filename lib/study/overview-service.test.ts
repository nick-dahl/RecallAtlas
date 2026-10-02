import { describe, expect, it } from 'vitest';
import { MemoryStore } from '@/lib/db/memory-store';
import { days, NOW, TEST_COURSE } from '@/lib/engine/test-fixtures';
import { enroll, getCourseOverview } from './overview-service';
import { allGraduated, enrolledStore, testContext } from './test-helpers';

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

describe('enroll', () => {
  it('is idempotent', async () => {
    const ctx = testContext(new MemoryStore());
    await enroll(ctx);
    await enroll(ctx);
    expect((await getCourseOverview(ctx)).enrolled).toBe(true);
  });
});
