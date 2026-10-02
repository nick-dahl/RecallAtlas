import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { graduate, isDue, newPromptState, type PromptState } from '@/lib/engine';
import { NOW } from '@/lib/engine/test-fixtures';
import { SessionConflictError, StaleSessionError, type UserStore } from './store';

const SLUG = 'contract-course';
const graduated = (key: string): PromptState =>
  graduate({ ...newPromptState(key, 'flag_to_name'), phase: 'learning', rung: 3 }, NOW);

/** Behavior every UserStore must share. Run against MemoryStore (unit) and SupabaseStore (integration). */
export function describeStoreContract(
  name: string,
  setup: () => Promise<{ store: UserStore; cleanup?: () => Promise<void> }>,
) {
  describe(`${name} satisfies the UserStore contract`, () => {
    let store: UserStore;
    let cleanup: (() => Promise<void>) | undefined;

    beforeEach(async () => {
      ({ store, cleanup } = await setup());
    });
    afterEach(async () => {
      await cleanup?.();
    });

    async function openSession(state: unknown = { step: 0 }) {
      await store.enroll(SLUG);
      return store.createSession({ courseSlug: SLUG, kind: 'study', state, pendingQuestion: null });
    }

    it('enrolls idempotently', async () => {
      expect(await store.getEnrollment(SLUG)).toBeNull();
      const first = await store.enroll(SLUG);
      const second = await store.enroll(SLUG);
      expect(second.createdAt).toEqual(first.createdAt);
      expect(first).toMatchObject({ courseSlug: SLUG, placementCompletedAt: null, passedAt: null });
    });

    it('sets placement completion once', async () => {
      await store.enroll(SLUG);
      const at = new Date('2026-10-02T10:00:00Z');
      await store.setPlacementCompleted(SLUG, at);
      await store.setPlacementCompleted(SLUG, new Date('2026-10-03T10:00:00Z'));
      expect((await store.getEnrollment(SLUG))!.placementCompletedAt).toEqual(at);
    });

    it('creates one active session per course and rejects a second', async () => {
      const session = await openSession({ step: 1 });
      expect(session.version).toBe(0);
      const active = await store.getActiveSession(SLUG);
      expect(active).toMatchObject({ id: session.id, kind: 'study', state: { step: 1 }, pendingQuestion: null });
      await expect(
        store.createSession({ courseSlug: SLUG, kind: 'exam', state: {}, pendingQuestion: null }),
      ).rejects.toBeInstanceOf(SessionConflictError);
    });

    it('resolves two concurrent creates to exactly one winner', async () => {
      await store.enroll(SLUG);
      const results = await Promise.allSettled([
        store.createSession({ courseSlug: SLUG, kind: 'study', state: {}, pendingQuestion: null }),
        store.createSession({ courseSlug: SLUG, kind: 'study', state: {}, pendingQuestion: null }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(SessionConflictError);
    });

    it('commits a turn: state, version, prompt states with revived dates', async () => {
      const session = await openSession();
      const ec = graduated('EC');
      await store.commitTurn(SLUG, {
        sessionId: session.id,
        expectedVersion: 0,
        sessionState: { step: 1 },
        pendingQuestion: null,
        completed: false,
        promptStates: [ec],
      });
      const active = await store.getActiveSession(SLUG);
      expect(active).toMatchObject({ version: 1, state: { step: 1 } });
      const [loaded] = await store.getPromptStates(SLUG);
      expect(loaded).toEqual(ec);
      expect(isDue(loaded, ec.fsrs!.due)).toBe(true);
    });

    it('rejects a stale version and a completed session', async () => {
      const session = await openSession();
      const base = { sessionId: session.id, sessionState: {}, pendingQuestion: null, promptStates: [] };
      await expect(
        store.commitTurn(SLUG, { ...base, expectedVersion: 5, completed: false }),
      ).rejects.toBeInstanceOf(StaleSessionError);
      await store.commitTurn(SLUG, { ...base, expectedVersion: 0, completed: true });
      expect(await store.getActiveSession(SLUG)).toBeNull();
      await expect(
        store.commitTurn(SLUG, { ...base, expectedVersion: 1, completed: false }),
      ).rejects.toBeInstanceOf(StaleSessionError);
    });

    it('rejects a commit whose courseSlug does not match the session', async () => {
      const session = await openSession();
      await expect(
        store.commitTurn('a-different-course', {
          sessionId: session.id,
          expectedVersion: 0,
          sessionState: {},
          pendingQuestion: null,
          completed: false,
          promptStates: [],
        }),
      ).rejects.toBeInstanceOf(StaleSessionError);
      const active = await store.getActiveSession(SLUG);
      expect(active).toMatchObject({ id: session.id, version: 0 });
    });

    it('stores only the last occurrence of a duplicated prompt state', async () => {
      const session = await openSession();
      const first = graduated('EC');
      const second: PromptState = { ...first, streak: first.streak + 1 };
      await store.commitTurn(SLUG, {
        sessionId: session.id,
        expectedVersion: 0,
        sessionState: {},
        pendingQuestion: null,
        completed: false,
        promptStates: [first, second],
      });
      const states = await store.getPromptStates(SLUG);
      expect(states).toHaveLength(1);
      expect(states[0]).toEqual(second);
    });

    it('increments confusions and returns them sorted', async () => {
      const session = await openSession();
      const commit = (v: number, asked: string, answered: string) =>
        store.commitTurn(SLUG, {
          sessionId: session.id,
          expectedVersion: v,
          sessionState: {},
          pendingQuestion: null,
          completed: false,
          promptStates: [],
          confusion: { asked, answered },
        });
      await commit(0, 'TD', 'RO');
      await commit(1, 'EC', 'CO');
      await commit(2, 'TD', 'RO');
      expect(await store.getConfusions(SLUG)).toEqual([
        { asked: 'EC', answered: 'CO', count: 1 },
        { asked: 'TD', answered: 'RO', count: 2 },
      ]);
    });

    it('records answers, enrollment milestones (set once) and exam attempts', async () => {
      const session = await openSession();
      const passedAt = new Date('2026-10-02T12:00:00Z');
      await store.commitTurn(SLUG, {
        sessionId: session.id,
        expectedVersion: 0,
        sessionState: {},
        pendingQuestion: null,
        completed: false,
        promptStates: [],
        answer: {
          questionId: randomUUID(),
          context: 'exam',
          kind: 'prompt',
          itemKey: 'EC',
          promptType: 'flag_to_name',
          format: 'typed',
          rung: 3,
          givenText: 'Ecuador',
          givenItemKey: 'EC',
          correct: true,
          responseMs: 1200,
        },
        enrollment: { passedAt },
        examAttempt: { score: 1, total: 1, passed: true, missedItemKeys: [] },
      });
      await store.commitTurn(SLUG, {
        sessionId: session.id,
        expectedVersion: 1,
        sessionState: {},
        pendingQuestion: null,
        completed: true,
        promptStates: [],
        enrollment: { passedAt: new Date('2027-01-01T00:00:00Z') },
      });
      expect((await store.getEnrollment(SLUG))!.passedAt).toEqual(passedAt);
      const attempts = await store.getExamAttempts(SLUG);
      expect(attempts).toHaveLength(1);
      expect(attempts[0]).toMatchObject({ sessionId: session.id, score: 1, total: 1, passed: true, missedItemKeys: [] });
    });

    it('completes a session', async () => {
      const session = await openSession();
      await store.completeSession(session.id);
      expect(await store.getActiveSession(SLUG)).toBeNull();
    });
  });
}
