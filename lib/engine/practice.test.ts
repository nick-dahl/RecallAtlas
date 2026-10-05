import { describe, expect, it } from 'vitest';
import { introduce } from './ladder';
import { planPractice } from './practice';
import { seededRng } from './random';
import { graduate } from './scheduler';
import { initialStates } from './state';
import { days, TEST_COURSE } from './test-fixtures';
import type { PromptState } from './types';

const course = TEST_COURSE;
const learnedOn = (when: Date) => (s: PromptState) => graduate({ ...introduce(s), rung: 3 }, when);

/** EC learned 60 days ago (likely fading); the other five learned yesterday; RO still learning. */
function states(): PromptState[] {
  return initialStates(course).map((s) => {
    if (s.itemKey === 'EC') return learnedOn(days(-60))(s);
    if (['US', 'CO', 'VE', 'PE', 'TD'].includes(s.itemKey)) return learnedOn(days(-1))(s);
    if (s.itemKey === 'RO') return introduce(s);
    return s;
  });
}

describe('planPractice', () => {
  it('checks only learned items, at most one prompt each, up to the size', () => {
    const plan = planPractice(states(), days(0), 20, seededRng(1));
    const items = plan.map((e) => e.itemKey);
    expect(plan).toHaveLength(6);
    expect(new Set(items)).toEqual(new Set(['US', 'EC', 'CO', 'VE', 'PE', 'TD']));
    expect(plan.every((e) => e.kind === 'prompt')).toBe(true);
    expect(planPractice(states(), days(0), 4, seededRng(1))).toHaveLength(4);
  });

  it('is empty when nothing has been learned', () => {
    expect(planPractice(initialStates(course), days(0), 20, seededRng(1))).toEqual([]);
  });

  it('is a random mix, not the same order every time', () => {
    const orders = new Set(Array.from({ length: 20 }, (_, seed) => planPractice(states(), days(0), 3, seededRng(seed)).map((e) => e.itemKey).join()));
    expect(orders.size).toBeGreaterThan(5);
  });

  it('favours what is most likely forgotten, but still includes recent material', () => {
    let fading = 0;
    let recent = 0;
    for (let seed = 0; seed < 400; seed++) {
      const picked = planPractice(states(), days(0), 2, seededRng(seed)).map((e) => e.itemKey);
      if (picked.includes('EC')) fading++;
      if (picked.includes('US')) recent++;
    }
    expect(fading).toBeGreaterThan(recent * 1.5);
    expect(recent).toBeGreaterThan(20);
  });

  it('is deterministic for a given seed', () => {
    expect(planPractice(states(), days(0), 5, seededRng(9))).toEqual(planPractice(states(), days(0), 5, seededRng(9)));
  });
});
