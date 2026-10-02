import { describe, expect, it } from 'vitest';
import { introduce } from './ladder';
import {
  deriveStatus,
  dueCount,
  itemTileState,
  needsReviewNudge,
  readiness,
  retentionHealth,
} from './progress';
import { applyReview, graduate } from './scheduler';
import { initialStates } from './state';
import { days, NOW, TEST_COURSE } from './test-fixtures';
import type { PromptState } from './types';

const grad = (s: PromptState, at = NOW) => graduate({ ...introduce(s), rung: 3 }, at);
const allReview = () => initialStates(TEST_COURSE).map((s) => grad(s));

describe('deriveStatus', () => {
  it('walks placement → learning → exam_ready → passed', () => {
    const fresh = initialStates(TEST_COURSE);
    expect(deriveStatus({ course: TEST_COURSE, states: fresh, placementCompleted: false, passedAt: null })).toBe('placement');
    expect(deriveStatus({ course: TEST_COURSE, states: fresh, placementCompleted: true, passedAt: null })).toBe('learning');
    expect(deriveStatus({ course: TEST_COURSE, states: allReview(), placementCompleted: true, passedAt: null })).toBe('exam_ready');
    expect(deriveStatus({ course: TEST_COURSE, states: fresh, placementCompleted: true, passedAt: NOW })).toBe('passed');
  });
});

describe('readiness', () => {
  it('counts graduated prompts over total prompts', () => {
    const states = initialStates(TEST_COURSE).map((s, i) => (i < 4 ? grad(s) : s));
    expect(readiness(TEST_COURSE, states)).toEqual({ graduated: 4, total: TEST_COURSE.items.length * 2 });
  });
});

describe('retentionHealth', () => {
  it('is ~1 right after graduating everything and falls over time', () => {
    const states = allReview();
    expect(retentionHealth(states, NOW)).toBeCloseTo(1, 2);
    expect(retentionHealth(states, days(60))).toBeLessThan(0.9);
    expect(needsReviewNudge(retentionHealth(states, days(60)))).toBe(true);
    expect(needsReviewNudge(retentionHealth(states, NOW))).toBe(false);
  });

  it('is 0 for no states', () => {
    expect(retentionHealth([], NOW)).toBe(0);
  });
});

describe('dueCount', () => {
  it('counts review prompts due now', () => {
    const states = allReview();
    expect(dueCount(states, NOW)).toBe(0);
    expect(dueCount(states, days(30))).toBe(states.length);
  });
});

describe('itemTileState', () => {
  const [a, b] = initialStates(TEST_COURSE).slice(0, 2);
  it('maps prompt states to a mastery-grid tile', () => {
    expect(itemTileState([a, b])).toBe('new');
    expect(itemTileState([introduce(a), { ...introduce(b), rung: 2 }])).toBe('learning-1');
    expect(itemTileState([grad(a), grad(b)])).toBe('review');
  });

  it('marks high-stability items as strong', () => {
    let s1 = grad(a, days(-200));
    let s2 = grad(b, days(-200));
    for (let i = 0; i < 4; i++) {
      s1 = applyReview(s1, 'good', s1.fsrs!.due);
      s2 = applyReview(s2, 'good', s2.fsrs!.due);
    }
    expect(s1.fsrs!.stability).toBeGreaterThanOrEqual(21);
    expect(itemTileState([s1, s2])).toBe('strong');
  });
});
