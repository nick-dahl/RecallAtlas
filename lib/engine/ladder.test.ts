import { describe, expect, it } from 'vitest';
import { applyLearningAnswer, introduce } from './ladder';
import { newPromptState } from './state';
import type { PromptState, Rung } from './types';

const learning = (rung: Rung, streak = 0): PromptState => ({
  ...newPromptState('EC', 'flag_to_name'),
  phase: 'learning',
  rung,
  streak,
});

describe('introduce', () => {
  it('moves a new prompt to learning at rung 1', () => {
    expect(introduce(newPromptState('EC', 'flag_to_name'))).toMatchObject({ phase: 'learning', rung: 1, streak: 0 });
  });

  it('leaves non-new prompts untouched', () => {
    const s = learning(2, 1);
    expect(introduce(s)).toBe(s);
  });
});

describe('applyLearningAnswer', () => {
  it('climbs from rung 1 after one correct', () => {
    expect(applyLearningAnswer(learning(1), true)).toEqual({ state: learning(2, 0), outcome: 'climbed' });
  });

  it('needs two consecutive correct at rung 2', () => {
    const first = applyLearningAnswer(learning(2), true);
    expect(first).toEqual({ state: learning(2, 1), outcome: 'held' });
    expect(applyLearningAnswer(first.state, true)).toEqual({ state: learning(3, 0), outcome: 'climbed' });
  });

  it('signals graduation after a correct recall at rung 3', () => {
    expect(applyLearningAnswer(learning(3), true)).toEqual({ state: learning(3, 0), outcome: 'graduate' });
  });

  it('drops one rung and resets the streak on a miss', () => {
    expect(applyLearningAnswer(learning(3), false)).toEqual({ state: learning(2, 0), outcome: 'dropped' });
    expect(applyLearningAnswer(learning(2, 1), false)).toEqual({ state: learning(1, 0), outcome: 'dropped' });
  });

  it('never drops below rung 1', () => {
    expect(applyLearningAnswer(learning(1), false).state.rung).toBe(1);
  });

  it('rejects prompts that are not in learning', () => {
    expect(() => applyLearningAnswer(newPromptState('EC', 'flag_to_name'), true)).toThrow(/learning/);
  });
});
