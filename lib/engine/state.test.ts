import { describe, expect, it } from 'vitest';
import { getItem, indexStates, initialStates, newPromptState, stateKey } from './state';
import { TEST_COURSE } from './test-fixtures';

describe('state helpers', () => {
  it('newPromptState starts new at rung 0 with no FSRS card', () => {
    expect(newPromptState('EC', 'flag_to_name')).toEqual({
      itemKey: 'EC',
      promptType: 'flag_to_name',
      phase: 'new',
      rung: 0,
      streak: 0,
      fsrs: null,
    });
  });

  it('initialStates creates one state per item × prompt type', () => {
    const states = initialStates(TEST_COURSE);
    expect(states).toHaveLength(TEST_COURSE.items.length * 2);
    expect(states.every((s) => s.phase === 'new')).toBe(true);
  });

  it('stateKey and indexStates round-trip', () => {
    const states = initialStates(TEST_COURSE);
    const idx = indexStates(states);
    expect(idx.get(stateKey('TD', 'name_to_flag'))?.itemKey).toBe('TD');
  });

  it('getItem throws for unknown keys', () => {
    expect(getItem(TEST_COURSE, 'EC').name).toBe('Ecuador');
    expect(() => getItem(TEST_COURSE, 'ZZ')).toThrow(/ZZ/);
  });
});
