import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seededRng } from '@/lib/engine';
import { NOW, TEST_MAP_COURSE } from '@/lib/engine/test-fixtures';
import { startExam, submitExamAnswer } from './exam-service';
import { gradeSubmission, issueQuestion } from './issue';
import { startPlacement, submitPlacementAnswer } from './placement-service';
import { startStudy, submitStudyAnswer } from './study-service';
import {
  allGraduated,
  clickOn,
  correctResponse,
  enrolledStore,
  fixtureMaps,
  OFF_REGION_KEYS,
  pendingFor,
  testContext,
} from './test-helpers';
import { ServiceError, type PendingQuestion } from './types';

const course = TEST_MAP_COURSE;
const SLUG = course.slug;
const maps = fixtureMaps();
const issue = (entry: PendingQuestion['entry'], rung: 1 | 2 | 3, confusions = [] as { asked: string; answered: string; count: number }[]) =>
  issueQuestion({ entry, rung, course, confusions, rng: seededRng(3), now: NOW, newId: randomUUID, maps });
const find = { kind: 'prompt' as const, itemKey: 'EC', promptType: 'find' };
const bad = (fn: () => unknown) => expect(fn).toThrow(new ServiceError('invalid_response'));

describe('issuing and grading map questions', () => {
  it('records the frame the learner sees', () => {
    expect(issue(find, 1).frame).toBe('fx-region');
    expect(issue(find, 3).frame).toBe('fx-continent');
    expect(issue({ kind: 'prompt', itemKey: 'EC', promptType: 'capital' }, 3).frame).toBe('fx-region');
  });

  it('never offers a candidate that is not drawn, even a strong confusion', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = issueQuestion({
        entry: find,
        rung: 2,
        course,
        confusions: [{ asked: 'EC', answered: 'IN', count: 9 }],
        rng: seededRng(seed),
        now: NOW,
        newId: randomUUID,
        maps,
      });
      expect(p.choices.some((c) => OFF_REGION_KEYS.includes(c.itemKey))).toBe(false);
    }
  });

  it('grades a click against the issued frame: target, another country, ocean', () => {
    const p = issue(find, 3);
    expect(gradeSubmission(p, clickOn(p, maps, 'EC'), course, maps)).toEqual({ correct: true, typo: false, answeredItemKey: null });
    expect(gradeSubmission(p, clickOn(p, maps, 'PE'), course, maps)).toEqual({ correct: false, typo: false, answeredItemKey: 'PE' });
    expect(gradeSubmission(p, { kind: 'point', x: 0.99, y: 0.99, width: 1000 }, course, maps)).toEqual({
      correct: false,
      typo: false,
      answeredItemKey: null,
    });
  });

  it('rejects a click for a non-click question, and text or a choice for a click question', () => {
    const click = issue(find, 3);
    const typed = issue({ kind: 'prompt', itemKey: 'EC', promptType: 'name' }, 3);
    const pick = issue(find, 1);
    bad(() => gradeSubmission(typed, { kind: 'point', x: 0.1, y: 0.1, width: 800 }, course, maps));
    bad(() => gradeSubmission(pick, { kind: 'point', x: 0.1, y: 0.1, width: 800 }, course, maps));
    bad(() => gradeSubmission(click, { kind: 'typed', text: 'Ecuador' }, course, maps));
    bad(() => gradeSubmission(click, { kind: 'choice', choiceId: randomUUID() }, course, maps));
    bad(() => gradeSubmission(click, { kind: 'point', x: 0.1, y: 0.1, width: 800 }, course));
  });

  it('grades typed capitals, with other capitals as confusions', () => {
    const p = issue({ kind: 'prompt', itemKey: 'EC', promptType: 'capital' }, 3);
    expect(gradeSubmission(p, { kind: 'typed', text: 'quito' }, course, maps).correct).toBe(true);
    expect(gradeSubmission(p, { kind: 'typed', text: 'Lima' }, course, maps)).toEqual({ correct: false, typo: false, answeredItemKey: 'PE' });
    expect(gradeSubmission(p, { kind: 'typed', text: 'Ecuador' }, course, maps).correct).toBe(false);
  });
});

describe('World Map-style services', () => {
  it('places by clicking: graduates Find + Name, records a wrong click as a confusion', async () => {
    const { store } = await enrolledStore({ course });
    const ctx = testContext(store, { course, maps });
    let turn = await startPlacement(ctx);
    expect(turn.next).toMatchObject({ format: 'map-click', prompt: { name: 'United States' } });
    expect(turn.next!.map!.baseUrl).toBe('/maps/fx-continent.svg');

    turn = await submitPlacementAnswer(ctx, {
      sessionId: turn.next!.sessionId,
      questionId: turn.next!.questionId,
      response: correctResponse(await pendingFor(store, SLUG), course, maps),
    });
    expect(turn.feedback).toMatchObject({ correct: true, answer: { name: 'United States' } });
    expect(turn.feedback!.map!.correct).toBeDefined();
    const us = (await store.getPromptStates(SLUG)).filter((s) => s.itemKey === 'US');
    expect(Object.fromEntries(us.map((s) => [s.promptType, s.phase]))).toMatchObject({ find: 'review', name: 'review' });
    expect(us.find((s) => s.promptType === 'capital')?.phase ?? 'new').toBe('new');

    const wrong = await submitPlacementAnswer(ctx, {
      sessionId: turn.next!.sessionId,
      questionId: turn.next!.questionId,
      response: clickOn(await pendingFor(store, SLUG), maps, 'CO'),
    });
    expect(wrong.feedback).toMatchObject({ correct: false, given: { name: 'Colombia' } });
    expect(wrong.feedback!.map!.given).toBeDefined();
    expect(await store.getConfusions(SLUG)).toEqual([{ asked: 'EC', answered: 'CO', count: 1 }]);
  });

  it('introduces the capital of a placed item in study', async () => {
    const { store } = await enrolledStore({ course, placementDone: true });
    const ctx = testContext(store, { course, maps });
    let turn = await startPlacement(testContext(store, { course, maps })).catch(() => null);
    expect(turn).toBeNull(); // placement already done
    turn = await startStudy(ctx);
    expect(turn.next).toMatchObject({ format: 'intro', prompt: { name: 'United States' } });
    expect(turn.next!.map!.highlight).toBeDefined();
    turn = await submitStudyAnswer(ctx, { sessionId: turn.next!.sessionId, questionId: turn.next!.questionId, response: { kind: 'ack' } });
    expect(turn.next).toBeTruthy();
  });

  it('runs an exam by clicks and typed answers', async () => {
    const { store } = await enrolledStore({ course, placementDone: true });
    await store.commitTurn(SLUG, {
      sessionId: (await store.createSession({ courseSlug: SLUG, kind: 'study', state: {}, pendingQuestion: null })).id,
      expectedVersion: 0,
      sessionState: {},
      pendingQuestion: null,
      completed: true,
      promptStates: allGraduated(course),
    });
    const ctx = testContext(store, { course, maps });
    let turn = await startExam(ctx);
    const formats = new Set<string>();
    while (turn.next) {
      formats.add(turn.next.format);
      turn = await submitExamAnswer(ctx, {
        sessionId: turn.next.sessionId,
        questionId: turn.next.questionId,
        response: correctResponse(await pendingFor(store, SLUG), course, maps),
      });
    }
    expect(turn.end?.examResult).toMatchObject({ score: 17, total: 17, passed: true });
    expect([...formats].every((f) => f === 'map-click' || f === 'typed')).toBe(true);
  });
});
