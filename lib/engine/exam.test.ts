import { describe, expect, it } from 'vitest';
import { applyExamAnswer, buildExamQueue, isExamReady, scoreExam } from './exam';
import { applyLearningAnswer, introduce, type LadderOutcome } from './ladder';
import { seededRng } from './random';
import { graduate } from './scheduler';
import { initialStates } from './state';
import { NOW, TEST_COURSE } from './test-fixtures';
import type { AnswerGrade, PromptState } from './types';

const allReview = (): PromptState[] =>
  initialStates(TEST_COURSE).map((s) => graduate({ ...introduce(s), rung: 3 }, NOW));

describe('isExamReady', () => {
  it('requires every prompt in review', () => {
    expect(isExamReady(TEST_COURSE, allReview())).toBe(true);
    const oneLearning = allReview().map((s, i) => (i === 0 ? { ...s, phase: 'learning' as const } : s));
    expect(isExamReady(TEST_COURSE, oneLearning)).toBe(false);
  });

  it('is false when states are missing', () => {
    expect(isExamReady(TEST_COURSE, allReview().slice(1))).toBe(false);
  });
});

describe('buildExamQueue', () => {
  it('asks each item exactly once with a valid prompt type', () => {
    const q = buildExamQueue(TEST_COURSE, seededRng(4));
    expect(q.position).toBe(0);
    expect(q.queue.map((e) => e.itemKey).sort()).toEqual(TEST_COURSE.items.map((i) => i.key).sort());
    for (const e of q.queue) {
      expect(e.kind).toBe('prompt');
      if (e.kind === 'prompt') expect(['flag_to_name', 'name_to_flag']).toContain(e.promptType);
    }
  });
});

describe('applyExamAnswer', () => {
  it('counts as a review: wrong lapses, right stays in review', () => {
    const s = allReview()[0];
    expect(applyExamAnswer(s, { correct: true, typo: false, answeredItemKey: null }, NOW).phase).toBe('review');
    expect(applyExamAnswer(s, { correct: false, typo: false, answeredItemKey: null }, NOW)).toMatchObject({
      phase: 'learning',
      rung: 2,
    });
  });

  it('leaves non-review prompts unchanged', () => {
    const s = initialStates(TEST_COURSE)[0];
    expect(applyExamAnswer(s, { correct: true, typo: false, answeredItemKey: null }, NOW)).toBe(s);
  });
});

describe('scoreExam', () => {
  it('passes only at 100% with every question answered', () => {
    expect(scoreExam([{ itemKey: 'A', correct: true }, { itemKey: 'B', correct: true }], 2)).toEqual({
      score: 2,
      total: 2,
      passed: true,
      missed: [],
    });
    expect(scoreExam([{ itemKey: 'A', correct: true }, { itemKey: 'B', correct: false }], 2)).toEqual({
      score: 1,
      total: 2,
      passed: false,
      missed: ['B'],
    });
    expect(scoreExam([{ itemKey: 'A', correct: true }], 2).passed).toBe(false);
  });

  it('does not let a duplicate result compensate for an unanswered item', () => {
    expect(scoreExam([{ itemKey: 'A', correct: true }, { itemKey: 'A', correct: true }], 2)).toMatchObject({
      score: 1,
      passed: false,
    });
  });
});

describe('exam gating end-to-end (spec §9: fail → re-lock → re-graduate → unlock)', () => {
  it('re-locks the exam on a miss and unlocks it again once the prompt reclimbs the ladder', () => {
    const wrong: AnswerGrade = { correct: false, typo: false, answeredItemKey: null };

    let states = allReview();
    expect(isExamReady(TEST_COURSE, states)).toBe(true);

    // Miss one prompt on the exam: it lapses back into learning and re-locks the exam.
    let target = applyExamAnswer(states[0], wrong, NOW);
    states = [target, ...states.slice(1)];
    expect(target).toMatchObject({ phase: 'learning', rung: 2 });
    expect(isExamReady(TEST_COURSE, states)).toBe(false);

    // Re-climb: rung 2 needs 2 correct to reach rung 3, rung 3 needs 1 more to graduate.
    let outcome: LadderOutcome;
    ({ state: target, outcome } = applyLearningAnswer(target, true));
    expect(outcome).toBe('held');
    expect(target.rung).toBe(2);

    ({ state: target, outcome } = applyLearningAnswer(target, true));
    expect(outcome).toBe('climbed');
    expect(target.rung).toBe(3);

    ({ state: target, outcome } = applyLearningAnswer(target, true));
    expect(outcome).toBe('graduate');

    // Graduating puts the prompt back in review, unlocking the exam again.
    target = graduate(target, NOW);
    states = [target, ...states.slice(1)];
    expect(target.phase).toBe('review');
    expect(isExamReady(TEST_COURSE, states)).toBe(true);
  });
});
