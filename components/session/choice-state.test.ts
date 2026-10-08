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
  it('marks the right answer by capital when the options are capitals', () => {
    const capitalFeedback = { ...feedback, answer: { name: 'Bolivia', flag: 'data:bo', capital: 'Sucre' } };
    expect(choiceState({ id: '1', label: 'Sucre' }, capitalFeedback, '2')).toBe('correct');
    expect(choiceState({ id: '2', label: 'Lima' }, capitalFeedback, '2')).toBe('wrong');
  });
  it('marks the learner’s wrong pick and dims the rest', () => {
    expect(choiceState({ id: '2', label: 'Romania' }, feedback, '2')).toBe('wrong');
    expect(choiceState({ id: '3', label: 'Andorra' }, feedback, '2')).toBe('dim');
  });
});

describe('choiceState for presidents', () => {
  const president = {
    correct: false,
    typo: false,
    answer: { name: 'Grover Cleveland', portrait: 'p', startYears: [1885, 1893], party: 'Democratic' },
  };

  it('marks a year option right when it is any of the answer’s start years', () => {
    expect(choiceState({ id: '1', label: '1893' }, president, '2')).toBe('correct');
    expect(choiceState({ id: '2', label: '1889' }, president, '2')).toBe('wrong');
  });

  it('marks a party option right when it is the answer’s party', () => {
    expect(choiceState({ id: '1', label: 'Democratic' }, president, '2')).toBe('correct');
    expect(choiceState({ id: '3', label: 'Whig' }, president, '2')).toBe('dim');
  });

  it('marks a portrait option by its image', () => {
    expect(choiceState({ id: '1', portrait: 'p' }, president, '2')).toBe('correct');
    expect(choiceState({ id: '2', portrait: 'q' }, president, '2')).toBe('wrong');
  });
});

describe('choiceState from the server’s answer choice (paintings regression)', () => {
  const painting = {
    correct: true,
    typo: false,
    answerChoiceId: 'c2',
    answer: { name: 'The Night Watch', painting: 'data:nw', artist: 'Rembrandt', movement: 'Dutch Golden Age' },
  };

  it('marks a correctly picked painting right, never red', () => {
    expect(choiceState({ id: 'c2', painting: 'thumb:nw' }, painting, 'c2')).toBe('correct');
    expect(choiceState({ id: 'c1', painting: 'thumb:x' }, painting, 'c2')).toBe('dim');
  });

  it('marks a correct artist or movement label right, though it is not the painting’s name', () => {
    expect(choiceState({ id: 'c2', label: 'Rembrandt' }, painting, 'c2')).toBe('correct');
    expect(choiceState({ id: 'c2', label: 'Dutch Golden Age' }, painting, 'c2')).toBe('correct');
  });

  it('on a miss, marks the pick wrong and the server’s answer right', () => {
    const miss = { ...painting, correct: false };
    expect(choiceState({ id: 'c1', label: 'Vermeer' }, miss, 'c1')).toBe('wrong');
    expect(choiceState({ id: 'c2', label: 'Rembrandt' }, miss, 'c1')).toBe('correct');
  });
});
