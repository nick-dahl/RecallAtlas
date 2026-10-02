import { describe, expect, it } from 'vitest';
import { applyExamAnswer, buildExamQueue, isExamReady, scoreExam } from './exam';
import { introduce } from './ladder';
import { seededRng } from './random';
import { graduate } from './scheduler';
import { initialStates } from './state';
import { NOW, TEST_COURSE } from './test-fixtures';
import type { PromptState } from './types';

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
