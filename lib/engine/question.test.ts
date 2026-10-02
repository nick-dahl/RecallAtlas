import { describe, expect, it } from 'vitest';
import { buildQuestion, rungForState } from './question';
import { seededRng } from './random';
import { newPromptState } from './state';
import { TEST_COURSE } from './test-fixtures';

const base = { course: TEST_COURSE, confusions: [], rng: seededRng(11) };

describe('buildQuestion', () => {
  it('builds an intro card', () => {
    expect(buildQuestion({ ...base, entry: { kind: 'intro', itemKey: 'EC' }, rung: 1 })).toEqual({
      entry: { kind: 'intro', itemKey: 'EC' },
      format: 'intro',
    });
  });

  it('builds a contrast drill with both items as choices', () => {
    const q = buildQuestion({ ...base, entry: { kind: 'contrast', itemKey: 'TD', otherKey: 'RO' }, rung: 1 });
    expect(q.format).toBe('contrast');
    expect([...q.choiceKeys!].sort()).toEqual(['RO', 'TD']);
  });

  it('builds a 4-option text MC at rung 1 for flag_to_name', () => {
    const q = buildQuestion({ ...base, entry: { kind: 'prompt', itemKey: 'EC', promptType: 'flag_to_name' }, rung: 1 });
    expect(q.format).toBe('mc-text');
    expect(q.choiceKeys).toHaveLength(4);
    expect(q.choiceKeys).toContain('EC');
  });

  it('builds a typed question at rung 3 for flag_to_name', () => {
    const q = buildQuestion({ ...base, entry: { kind: 'prompt', itemKey: 'EC', promptType: 'flag_to_name' }, rung: 3 });
    expect(q).toEqual({ entry: { kind: 'prompt', itemKey: 'EC', promptType: 'flag_to_name' }, format: 'typed' });
  });

  it('builds an 8-flag grid with look-alikes at rung 3 for name_to_flag', () => {
    const q = buildQuestion({ ...base, entry: { kind: 'prompt', itemKey: 'TD', promptType: 'name_to_flag' }, rung: 3 });
    expect(q.format).toBe('flag-grid');
    expect(q.choiceKeys).toHaveLength(8);
    expect(q.choiceKeys).toEqual(expect.arrayContaining(['TD', 'RO']));
  });

  it('throws for an unknown prompt type', () => {
    expect(() =>
      buildQuestion({ ...base, entry: { kind: 'prompt', itemKey: 'EC', promptType: 'nope' }, rung: 1 }),
    ).toThrow(/nope/);
  });
});

describe('rungForState', () => {
  it('uses recall for reviews and the current rung (min 1) otherwise', () => {
    const s = newPromptState('EC', 'flag_to_name');
    expect(rungForState(s)).toBe(1);
    expect(rungForState({ ...s, phase: 'learning', rung: 2 })).toBe(2);
    expect(rungForState({ ...s, phase: 'review', rung: 3 })).toBe(3);
  });
});
