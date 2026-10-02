import { describe, expect, it } from 'vitest';
import { confusedWith, recordConfusion, shouldInjectContrast, topConfusions } from './confusion';
import type { Confusion } from './types';

describe('recordConfusion', () => {
  it('adds a new pair with count 1', () => {
    expect(recordConfusion([], 'TD', 'RO')).toEqual({ confusions: [{ asked: 'TD', answered: 'RO', count: 1 }], count: 1 });
  });

  it('increments an existing pair without mutating input', () => {
    const list: Confusion[] = [{ asked: 'TD', answered: 'RO', count: 1 }];
    const r = recordConfusion(list, 'TD', 'RO');
    expect(r.count).toBe(2);
    expect(r.confusions).toEqual([{ asked: 'TD', answered: 'RO', count: 2 }]);
    expect(list[0].count).toBe(1);
  });
});

describe('shouldInjectContrast', () => {
  it('triggers from the threshold upward', () => {
    expect(shouldInjectContrast(1)).toBe(false);
    expect(shouldInjectContrast(2)).toBe(true);
    expect(shouldInjectContrast(5)).toBe(true);
  });
});

const sample: Confusion[] = [
  { asked: 'TD', answered: 'RO', count: 2 },
  { asked: 'RO', answered: 'TD', count: 2 },
  { asked: 'EC', answered: 'CO', count: 3 },
  { asked: 'EC', answered: 'VE', count: 1 },
];

describe('confusedWith', () => {
  it('returns partners in both directions, most confused first', () => {
    expect(confusedWith(sample, 'EC')).toEqual(['CO', 'VE']);
    expect(confusedWith(sample, 'RO')).toEqual(['TD']);
    expect(confusedWith(sample, 'US')).toEqual([]);
  });
});

describe('topConfusions', () => {
  it('merges directions into unordered pairs and sorts by count', () => {
    expect(topConfusions(sample, 2)).toEqual([
      { a: 'RO', b: 'TD', count: 4 },
      { a: 'CO', b: 'EC', count: 3 },
    ]);
  });
});
