import { describe, expect, it } from 'vitest';
import type { FeedbackView } from '@/lib/study/types';
import { candidateState, normalizePoint } from './geometry';

const rect = { left: 100, top: 50, width: 400, height: 200 };

describe('normalizePoint', () => {
  it('maps a click to [0,1] of the rendered box, whatever its size', () => {
    expect(normalizePoint(300, 150, rect)).toEqual({ x: 0.5, y: 0.5, width: 400 });
    expect(normalizePoint(100, 50, rect)).toEqual({ x: 0, y: 0, width: 400 });
    expect(normalizePoint(500, 250, rect)).toEqual({ x: 1, y: 1, width: 400 });
  });

  it('clamps clicks on the border and widths the server would reject', () => {
    expect(normalizePoint(99, 251, rect)).toMatchObject({ x: 0, y: 1 });
    expect(normalizePoint(10, 10, { left: 0, top: 0, width: 60.4, height: 30 }).width).toBe(100);
    expect(normalizePoint(10, 10, { left: 0, top: 0, width: 5000, height: 30 }).width).toBe(4000);
    expect(normalizePoint(10, 10, { left: 0, top: 0, width: 640.6, height: 30 }).width).toBe(641);
  });
});

describe('candidateState', () => {
  const feedback = (correct: string): FeedbackView => ({
    correct: false,
    typo: false,
    answer: { name: 'Peru', flag: 'f' },
    map: { baseUrl: '/maps/x.svg', width: 1000, height: 500, correct },
  });

  it('is idle before feedback', () => {
    expect(candidateState('M1Z', 'a', null, null)).toBe('idle');
  });

  it('marks the candidate drawn as the correct outline, the chosen miss, and dims the rest', () => {
    expect(candidateState('M1Z', 'a', feedback('M1Z'), 'b')).toBe('correct');
    expect(candidateState('M2Z', 'b', feedback('M1Z'), 'b')).toBe('wrong');
    expect(candidateState('M3Z', 'c', feedback('M1Z'), 'b')).toBe('dim');
  });
});
