import { describe, expect, it } from 'vitest';
import { paintingFeedback } from './painting-feedback';

const answer = { name: 'The Night Watch', artist: 'Rembrandt', year: '1642', movement: 'Dutch Golden Age' };
const tulp = { name: 'The Anatomy Lesson of Dr Nicolaes Tulp', artist: 'Rembrandt', year: '1632', movement: 'Dutch Golden Age' };

describe('paintingFeedback', () => {
  it('states the fact asked, and names what the learner gave', () => {
    expect(paintingFeedback('title', { correct: true, typo: false, answer })).toEqual({ headline: 'Correct: The Night Watch', detail: 'Rembrandt, 1642 · Dutch Golden Age' });
    expect(paintingFeedback('title', { correct: true, typo: true, answer }).headline).toBe('Correct. It’s spelled “The Night Watch”');
    expect(paintingFeedback('title', { correct: false, typo: false, answer, given: tulp })).toEqual({
      headline: 'Not quite: it’s The Night Watch', detail: 'You named The Anatomy Lesson of Dr Nicolaes Tulp.',
    });
    expect(paintingFeedback('artist', { correct: false, typo: false, answer }).headline).toBe('Not quite: The Night Watch is by Rembrandt (1642)');
    expect(paintingFeedback('movement', { correct: true, typo: false, answer }).headline).toBe('Correct: The Night Watch is Dutch Golden Age');
    expect(paintingFeedback(undefined, { correct: false, typo: false, answer }).headline).toBe('Not quite: that’s The Night Watch');
  });
});
