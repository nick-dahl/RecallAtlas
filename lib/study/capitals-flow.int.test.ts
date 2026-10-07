import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seededRng } from '@/lib/engine';
import { WORLD_CAPITALS } from '@/lib/content/world-capitals';
import { createSupabaseStore } from '@/lib/db/supabase-store';
import type { UserStore } from '@/lib/db/store';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ServiceContext } from './context';
import { startExam, submitExamAnswer } from './exam-service';
import { enroll, getCourseOverview } from './overview-service';
import { startPlacement, submitPlacementAnswer } from './placement-service';
import { getMapSupport, getPresenter } from './presenters';
import { startStudy, submitStudyAnswer } from './study-service';
import { correctResponse, pendingFor } from './test-helpers';

const admin = createAdminClient();
const SLUG = WORLD_CAPITALS.slug;
let userId: string;
let store: UserStore;

const ctx = (): ServiceContext => ({
  store,
  course: WORLD_CAPITALS,
  presenter: getPresenter(WORLD_CAPITALS),
  maps: getMapSupport(WORLD_CAPITALS),
  now: new Date(),
  rng: seededRng(Date.now() % 100_000),
  newId: randomUUID,
});

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: `capitals-flow-${randomUUID()}@example.com`,
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

describe('World Capitals end to end on Supabase', () => {
  it('places by typing every capital, which fast-tracks both directions', async () => {
    await enroll(ctx());
    let turn = await startPlacement(ctx());
    expect(turn.next).toMatchObject({ format: 'typed' });
    expect(turn.next!.prompt.question).toMatch(/^What's the capital of /);
    expect(turn.next!.map?.locator).toBe(true);
    while (turn.next) {
      const pending = await pendingFor(store, SLUG);
      turn = await submitPlacementAnswer(ctx(), {
        sessionId: turn.next.sessionId,
        questionId: turn.next.questionId,
        response: correctResponse(pending, WORLD_CAPITALS),
      });
      expect(turn.feedback?.correct).toBe(true);
    }
    expect(turn.end).toEqual({ reason: 'placement_complete' });
    const overview = await getCourseOverview(ctx());
    expect(overview.status).toBe('exam_ready');
    expect(overview.readiness).toEqual({ graduated: 2 * 197, total: 2 * 197 });
  }, 600_000);

  it('passes the final exam, then runs a practice-ahead check without repeats', async () => {
    expect((await getCourseOverview(ctx())).status).toBe('exam_ready');

    let turn = await startExam(ctx());
    const formats = new Set<string>();
    while (turn.next) {
      formats.add(turn.next.format);
      const pending = await pendingFor(store, SLUG);
      turn = await submitExamAnswer(ctx(), {
        sessionId: turn.next.sessionId,
        questionId: turn.next.questionId,
        response: correctResponse(pending, WORLD_CAPITALS),
      });
    }
    expect(turn.end?.examResult).toMatchObject({ score: 197, total: 197, passed: true });
    expect([...formats]).toEqual(['typed']);

    let practice = await startStudy(ctx(), { mode: 'practice-ahead', size: 20 });
    const asked: string[] = [];
    while (practice.next) {
      const pending = await pendingFor(store, SLUG);
      asked.push(pending.entry.itemKey);
      practice = await submitStudyAnswer(ctx(), {
        sessionId: practice.next.sessionId,
        questionId: practice.next.questionId,
        response: correctResponse(pending, WORLD_CAPITALS),
      });
    }
    expect(asked).toHaveLength(20);
    expect(new Set(asked).size).toBe(20);
    expect(practice.end).toEqual({ reason: 'practice_complete', practiceResult: { checked: 20, remembered: 20 } });
  }, 600_000);
});
