import { describe, expect, it } from 'vitest';
import { applyReview, graduate, isDue, retrievability } from './scheduler';
import { newPromptState } from './state';
import { days, NOW } from './test-fixtures';
import type { PromptState } from './types';

const DAY = 86_400_000;
const learningRung3: PromptState = { ...newPromptState('EC', 'flag_to_name'), phase: 'learning', rung: 3 };

describe('graduate', () => {
  it('moves the prompt into review with a first interval of 1–7 days', () => {
    const s = graduate(learningRung3, NOW);
    expect(s.phase).toBe('review');
    expect(s.rung).toBe(3);
    expect(s.fsrs).not.toBeNull();
    const interval = s.fsrs!.due.getTime() - NOW.getTime();
    expect(interval).toBeGreaterThanOrEqual(1 * DAY);
    expect(interval).toBeLessThanOrEqual(7 * DAY);
  });

  it('re-graduates a lapsed card, keeping FSRS history', () => {
    const g = graduate(learningRung3, NOW);
    const lapsed = applyReview(g, 'again', g.fsrs!.due);
    const regraduated = graduate({ ...lapsed, rung: 3 }, g.fsrs!.due);
    expect(regraduated.phase).toBe('review');
    expect(regraduated.fsrs!.lapses).toBe(1);
    expect(regraduated.fsrs!.reps).toBeGreaterThan(lapsed.fsrs!.reps);
  });
});

describe('isDue', () => {
  it('is false right after graduation and true once the due date arrives', () => {
    const s = graduate(learningRung3, NOW);
    expect(isDue(s, NOW)).toBe(false);
    expect(isDue(s, s.fsrs!.due)).toBe(true);
  });

  it('is false for prompts not in review', () => {
    expect(isDue(learningRung3, days(100))).toBe(false);
  });
});

describe('applyReview', () => {
  it('grows the interval on a good review', () => {
    const g = graduate(learningRung3, NOW);
    const firstInterval = g.fsrs!.due.getTime() - NOW.getTime();
    const reviewedAt = g.fsrs!.due;
    const r = applyReview(g, 'good', reviewedAt);
    expect(r.phase).toBe('review');
    expect(r.fsrs!.due.getTime() - reviewedAt.getTime()).toBeGreaterThan(firstInterval);
  });

  it('schedules hard sooner than good', () => {
    const g = graduate(learningRung3, NOW);
    const at = g.fsrs!.due;
    expect(applyReview(g, 'hard', at).fsrs!.due.getTime()).toBeLessThan(applyReview(g, 'good', at).fsrs!.due.getTime());
  });

  it('lapses back to learning at rung 2 on again', () => {
    const g = graduate(learningRung3, NOW);
    const r = applyReview(g, 'again', g.fsrs!.due);
    expect(r).toMatchObject({ phase: 'learning', rung: 2, streak: 0 });
    expect(r.fsrs!.lapses).toBe(1);
  });

  it('rejects prompts not in review', () => {
    expect(() => applyReview(learningRung3, 'good', NOW)).toThrow(/review/);
  });
});

describe('retrievability', () => {
  it('is 0 for unlearned prompts, ~1 just after graduation, and decays', () => {
    expect(retrievability(learningRung3, NOW)).toBe(0);
    const g = graduate(learningRung3, NOW);
    expect(retrievability(g, NOW)).toBeCloseTo(1, 2);
    const atDue = retrievability(g, g.fsrs!.due);
    expect(atDue).toBeLessThan(0.95);
    expect(atDue).toBeGreaterThan(0.8);
  });
});
