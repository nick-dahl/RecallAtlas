import { describe, expect, it } from 'vitest';
import { randInt, seededRng, shuffle } from './random';

describe('seededRng', () => {
  it('is deterministic for the same seed', () => {
    const a = seededRng(42);
    const b = seededRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('differs across seeds and stays in [0, 1)', () => {
    const a = seededRng(1);
    const b = seededRng(2);
    expect(a()).not.toEqual(b());
    const r = seededRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('randInt', () => {
  it('stays within inclusive bounds and hits both ends', () => {
    const r = seededRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(randInt(r, 3, 5));
    expect([...seen].sort()).toEqual([3, 4, 5]);
  });
});

describe('shuffle', () => {
  it('returns a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = shuffle(input, seededRng(9));
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual(input);
  });
});
