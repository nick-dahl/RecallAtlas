import { describe, expect, it } from 'vitest';
import { getItem, hydrateStates, indexStates, initialStates, newPromptState, stateKey } from './state';
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

  it('hydrateStates overlays stored rows onto a fresh initial-states skeleton', () => {
    const introduced = { ...newPromptState('TD', 'flag_to_name'), phase: 'learning' as const, rung: 1 as const };
    const hydrated = hydrateStates(TEST_COURSE, [introduced, newPromptState('ZZ', 'flag_to_name')]);
    expect(hydrated).toHaveLength(TEST_COURSE.items.length * 2);
    expect(hydrated.find((s) => s.itemKey === 'TD' && s.promptType === 'flag_to_name')).toEqual(introduced);
    expect(hydrated.some((s) => s.itemKey === 'ZZ')).toBe(false);
    expect(hydrated.find((s) => s.itemKey === 'US' && s.promptType === 'flag_to_name')).toEqual(
      newPromptState('US', 'flag_to_name'),
    );
  });
});
