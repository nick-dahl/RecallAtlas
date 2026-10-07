import { describe, expect, it } from 'vitest';
import { startStudySession } from '@/lib/engine';
import { TEST_COURSE } from '@/lib/engine/test-fixtures';
import { startExam, submitExamAnswer } from './exam-service';
import { startStudy, submitStudyAnswer } from './study-service';
import { allGraduated, enrolledStore, testContext } from './test-helpers';
import { ServiceError, type PendingQuestion } from './types';

// A session saved before a course dropped one of its prompt types (World Map's old "capital"
// prompt) must not crash the learner; it is closed and a fresh one starts.
const SLUG = TEST_COURSE.slug;
const retired = { kind: 'prompt' as const, itemKey: 'US', promptType: 'retired' };
const pending = { questionId: 'q-old', entry: retired, format: 'typed', choices: [], issuedAt: 0 } as unknown as PendingQuestion;

describe('sessions that refer to a retired prompt type', () => {
  it('a study session asking one is replaced by a fresh session', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    const old = await store.createSession({ courseSlug: SLUG, kind: 'study', state: startStudySession(), pendingQuestion: pending });
    const turn = await startStudy(testContext(store));
    expect(turn.next!.sessionId).not.toBe(old.id);
  });

  it('a practice-ahead plan holding one is replaced by a fresh session', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    store.seedPromptStates(SLUG, allGraduated());
    const ok = { kind: 'prompt' as const, itemKey: 'US', promptType: TEST_COURSE.promptTypes[0].id };
    const state = startStudySession({ mode: 'practice-ahead', plan: [ok, retired] });
    const old = await store.createSession({
      courseSlug: SLUG,
      kind: 'study',
      state,
      pendingQuestion: { ...pending, entry: ok },
    });
    const turn = await startStudy(testContext(store), { mode: 'practice-ahead' });
    expect(turn.next?.sessionId).not.toBe(old.id);
  });

  it('an exam asking one does not block study, and the exam starts afresh', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    store.seedPromptStates(SLUG, allGraduated());
    const exam = { queue: [retired], position: 0, results: [] };
    const old = await store.createSession({ courseSlug: SLUG, kind: 'exam', state: exam, pendingQuestion: pending });
    const turn = await startExam(testContext(store));
    expect(turn.next!.sessionId).not.toBe(old.id);

    await store.completeSession(turn.next!.sessionId);
    await store.createSession({ courseSlug: SLUG, kind: 'exam', state: exam, pendingQuestion: pending });
    await expect(startStudy(testContext(store))).resolves.toBeDefined();
  });

  it('an answer to one is turned away as stale, closing the session', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    const old = await store.createSession({ courseSlug: SLUG, kind: 'study', state: startStudySession(), pendingQuestion: pending });
    const input = { sessionId: old.id, questionId: 'q-old', response: { kind: 'dont-know' as const } };
    await expect(submitStudyAnswer(testContext(store), input)).rejects.toEqual(new ServiceError('no_active_session'));
    expect(await store.getActiveSession(SLUG)).toBeNull();

    const exam = await store.createSession({ courseSlug: SLUG, kind: 'exam', state: { queue: [retired], position: 0, results: [] }, pendingQuestion: pending });
    await expect(submitExamAnswer(testContext(store), { ...input, sessionId: exam.id })).rejects.toEqual(
      new ServiceError('no_active_session'),
    );
    expect(await store.getActiveSession(SLUG)).toBeNull();
  });
});
