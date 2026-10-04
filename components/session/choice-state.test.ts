import { describe, expect, it } from 'vitest';
import { choiceState } from './choice-state';

const feedback = { correct: false, typo: false, answer: { name: 'Chad', flag: 'data:chad' }, given: { name: 'Romania', flag: 'data:ro' } };

describe('choiceState', () => {
  it('is idle before feedback', () => {
    expect(choiceState({ id: '1', label: 'Chad' }, null, null)).toBe('idle');
  });
  it('marks the right answer by label (text) or flag (grid)', () => {
    expect(choiceState({ id: '1', label: 'Chad' }, feedback, '2')).toBe('correct');
    expect(choiceState({ id: '1', flag: 'data:chad' }, feedback, '2')).toBe('correct');
  });
  it('marks the learner’s wrong pick and dims the rest', () => {
    expect(choiceState({ id: '2', label: 'Romania' }, feedback, '2')).toBe('wrong');
    expect(choiceState({ id: '3', label: 'Andorra' }, feedback, '2')).toBe('dim');
  });
});
