import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seededRng } from '@/lib/engine';
import { WORLD_MAP } from '@/lib/content/world-map';
import { createSupabaseStore } from '@/lib/db/supabase-store';
import type { UserStore } from '@/lib/db/store';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ServiceContext } from './context';
import { startExam, submitExamAnswer } from './exam-service';
import { enroll, getCourseOverview } from './overview-service';
import { startPlacement, submitPlacementAnswer } from './placement-service';
import { getMapSupport, getPresenter } from './presenters';
import { allGraduated, clickOn, correctResponse, pendingFor } from './test-helpers';

const admin = createAdminClient();
const maps = getMapSupport(WORLD_MAP)!;
const SLUG = WORLD_MAP.slug;
let userId: string;
let store: UserStore;

const ctx = (): ServiceContext => ({
  store,
  course: WORLD_MAP,
  presenter: getPresenter(WORLD_MAP),
  maps,
  now: new Date(),
  rng: seededRng(Date.now() % 100_000),
  newId: randomUUID,
});

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: `map-flow-${randomUUID()}@example.com`,
    password: randomUUID(),
    email_confirm: true,
  });
  if (error) throw error;
  userId = data.user.id;
  store = createSupabaseStore(admin, userId);
});

afterAll(async () => {
  await admin.auth.admin.deleteUser(userId);
});

describe('World Map end to end on Supabase', () => {
  it('places by clicking: one deliberate wrong click, the rest correct', async () => {
    await enroll(ctx());
    let turn = await startPlacement(ctx());
    expect(turn.next).toMatchObject({ format: 'map-click' });

    // Click a neighbour of the first country instead of the country itself.
    const first = await pendingFor(store, SLUG);
    const frame = maps.load(first.frame!);
    const neighbour = WORLD_MAP.items
      .find((i) => i.key === first.entry.itemKey)!
      .lookalikes.find((k) => frame.countries[k] && !frame.countries[k].sliver)!;
    turn = await submitPlacementAnswer(ctx(), {
      sessionId: turn.next!.sessionId,
      questionId: turn.next!.questionId,
      response: clickOn(first, maps, neighbour),
    });
    expect(turn.feedback).toMatchObject({ correct: false });
    expect(turn.feedback!.map!.given).toBeDefined();

    while (turn.next) {
      const pending = await pendingFor(store, SLUG);
      turn = await submitPlacementAnswer(ctx(), {
        sessionId: turn.next.sessionId,
        questionId: turn.next.questionId,
        response: correctResponse(pending, WORLD_MAP, maps),
      });
      expect(turn.feedback?.correct).toBe(true);
    }
    expect(turn.end).toEqual({ reason: 'placement_complete' });

    const overview = await getCourseOverview(ctx());
    expect(overview.status).toBe('learning');
    // Find + Name for every item but the missed one, which is learned in study.
    expect(overview.readiness).toEqual({ graduated: 2 * (WORLD_MAP.items.length - 1), total: 2 * WORLD_MAP.items.length });
    expect(await store.getConfusions(SLUG)).toEqual([{ asked: first.entry.itemKey, answered: neighbour, count: 1 }]);
  }, 600_000);

  it('passes the final exam by clicking and typing', async () => {
    // Fast-forward the missed country (studying it is the simulation's job, not this test's).
    const seed = await store.createSession({ courseSlug: SLUG, kind: 'study', state: {}, pendingQuestion: null });
    await store.commitTurn(SLUG, {
      sessionId: seed.id,
      expectedVersion: seed.version,
      sessionState: {},
      pendingQuestion: null,
      completed: true,
      promptStates: allGraduated(WORLD_MAP, new Date()),
    });
    expect((await getCourseOverview(ctx())).status).toBe('exam_ready');

    let turn = await startExam(ctx());
    while (turn.next) {
      const pending = await pendingFor(store, SLUG);
      turn = await submitExamAnswer(ctx(), {
        sessionId: turn.next.sessionId,
        questionId: turn.next.questionId,
        response: correctResponse(pending, WORLD_MAP, maps),
      });
    }
    expect(turn.end?.examResult).toMatchObject({ score: 208, total: 208, passed: true });
    expect((await getCourseOverview(ctx())).status).toBe('passed');
  }, 600_000);
});
