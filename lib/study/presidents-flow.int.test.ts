import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seededRng } from '@/lib/engine';
import { US_PRESIDENTS } from '@/lib/content/us-presidents';
import { createSupabaseStore } from '@/lib/db/supabase-store';
import type { UserStore } from '@/lib/db/store';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ServiceContext } from './context';
import { startExam, submitExamAnswer } from './exam-service';
import { enroll, getCourseOverview } from './overview-service';
import { startPlacement, submitPlacementAnswer } from './placement-service';
import { getPresenter } from './presenters';
import { startStudy, submitStudyAnswer } from './study-service';
import { allGraduated, correctResponse, pendingFor } from './test-helpers';

const admin = createAdminClient();
const SLUG = US_PRESIDENTS.slug;
let userId: string;
let store: UserStore;

const ctx = (): ServiceContext => ({
  store,
  course: US_PRESIDENTS,
  presenter: getPresenter(US_PRESIDENTS),
  now: new Date(),
  rng: seededRng(Date.now() % 100_000),
  newId: randomUUID,
});

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: `presidents-flow-${randomUUID()}@example.com`,
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

describe('US Presidents end to end on Supabase', () => {
  it('places by typing every president', async () => {
    await enroll(ctx());
    let turn = await startPlacement(ctx());
    expect(turn.next).toMatchObject({ format: 'typed' });
    expect(turn.next!.prompt.question).toBe('Who was the 1st president?');
    while (turn.next) {
      const pending = await pendingFor(store, SLUG);
      turn = await submitPlacementAnswer(ctx(), {
        sessionId: turn.next.sessionId,
        questionId: turn.next.questionId,
        response: correctResponse(pending, US_PRESIDENTS),
      });
      expect(turn.feedback?.correct).toBe(true);
    }
    expect(turn.end).toEqual({ reason: 'placement_complete' });
    const overview = await getCourseOverview(ctx());
    expect(overview.status).toBe('learning');
    expect(overview.readiness).toEqual({ graduated: 2 * 45, total: 6 * 45 });
  }, 600_000);

  it('passes the final exam, then runs a practice-ahead check without repeats', async () => {
    // Fast-forward faces, years and party (studying them is the simulation's job).
    const seed = await store.createSession({ courseSlug: SLUG, kind: 'study', state: {}, pendingQuestion: null });
    await store.commitTurn(SLUG, {
      sessionId: seed.id,
      expectedVersion: seed.version,
      sessionState: {},
      pendingQuestion: null,
      completed: true,
      promptStates: allGraduated(US_PRESIDENTS, new Date()),
    });
    expect((await getCourseOverview(ctx())).status).toBe('exam_ready');

    let turn = await startExam(ctx());
    const formats = new Set<string>();
    while (turn.next) {
      formats.add(turn.next.format);
      const pending = await pendingFor(store, SLUG);
      turn = await submitExamAnswer(ctx(), {
        sessionId: turn.next.sessionId,
        questionId: turn.next.questionId,
        response: correctResponse(pending, US_PRESIDENTS),
      });
    }
    expect(turn.end?.examResult).toMatchObject({ score: 45, total: 45, passed: true });
    expect([...formats].every((f) => ['typed', 'gap-typed', 'image-grid', 'mc-text'].includes(f))).toBe(true);

    let practice = await startStudy(ctx(), { mode: 'practice-ahead', size: 20 });
    const asked: string[] = [];
    while (practice.next) {
      const pending = await pendingFor(store, SLUG);
      asked.push(pending.entry.itemKey);
      practice = await submitStudyAnswer(ctx(), {
        sessionId: practice.next.sessionId,
        questionId: practice.next.questionId,
        response: correctResponse(pending, US_PRESIDENTS),
      });
    }
    expect(asked).toHaveLength(20);
    expect(new Set(asked).size).toBe(20);
    expect(practice.end).toEqual({ reason: 'practice_complete', practiceResult: { checked: 20, remembered: 20 } });
  }, 600_000);
});
