import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seededRng } from '@/lib/engine';
import { WORLD_FLAGS } from '@/lib/content/world-flags';
import { createSupabaseStore } from '@/lib/db/supabase-store';
import type { UserStore } from '@/lib/db/store';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ServiceContext } from './context';
import { startExam, submitExamAnswer } from './exam-service';
import { enroll, getCourseOverview } from './overview-service';
import { startPlacement, submitPlacementAnswer } from './placement-service';
import { getPresenter } from './presenters';
import { startStudy, submitStudyAnswer } from './study-service';
import { correctResponse, pendingFor } from './test-helpers';
import { ServiceError } from './types';

const admin = createAdminClient();
let userId: string;
let store: UserStore;

const ctx = (): ServiceContext => ({
  store,
  course: WORLD_FLAGS,
  presenter: getPresenter(WORLD_FLAGS),
  now: new Date(),
  rng: seededRng(Date.now() % 100_000),
  newId: randomUUID,
});

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: `flow-${randomUUID()}@example.com`,
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

describe('World Flags end to end on Supabase', () => {
  it('enrolls, rejects a duplicate submit, and sweeps placement with all correct answers', async () => {
    await enroll(ctx());
    let turn = await startPlacement(ctx());
    const first = turn.next!;
    turn = await submitPlacementAnswer(ctx(), {
      sessionId: first.sessionId,
      questionId: first.questionId,
      response: correctResponse(await pendingFor(store, WORLD_FLAGS.slug), WORLD_FLAGS),
    });
    await expect(
      submitPlacementAnswer(ctx(), { sessionId: first.sessionId, questionId: first.questionId, response: { kind: 'dont-know' } }),
    ).rejects.toEqual(new ServiceError('stale_question'));

    while (turn.next) {
      const pending = await pendingFor(store, WORLD_FLAGS.slug);
      turn = await submitPlacementAnswer(ctx(), {
        sessionId: turn.next.sessionId,
        questionId: turn.next.questionId,
        response: correctResponse(pending, WORLD_FLAGS),
      });
    }
    expect(turn.end).toEqual({ reason: 'placement_complete' });
    expect((await getCourseOverview(ctx())).status).toBe('exam_ready');
  }, 300_000);

  it('has nothing to study right after a perfect placement', async () => {
    expect(await startStudy(ctx())).toEqual({ next: null, end: { reason: 'caught_up' } });
  });

  it('passes the final exam with all correct answers', async () => {
    let turn = await startExam(ctx());
    while (turn.next) {
      const pending = await pendingFor(store, WORLD_FLAGS.slug);
      turn = await submitExamAnswer(ctx(), {
        sessionId: turn.next.sessionId,
        questionId: turn.next.questionId,
        response: correctResponse(pending, WORLD_FLAGS),
      });
    }
    expect(turn.end?.examResult).toMatchObject({ score: 197, total: 197, passed: true });
    const overview = await getCourseOverview(ctx());
    expect(overview.status).toBe('passed');
    expect(overview.passedAt).not.toBeNull();
  }, 300_000);

  it('can start a practice-ahead study session after passing', async () => {
    const turn = await startStudy(ctx(), { mode: 'practice-ahead', size: 10 });
    expect(turn.next?.sessionKind).toBe('study');
    await submitStudyAnswer(ctx(), {
      sessionId: turn.next!.sessionId,
      questionId: turn.next!.questionId,
      response: correctResponse(await pendingFor(store, WORLD_FLAGS.slug), WORLD_FLAGS),
    });
  });
});
