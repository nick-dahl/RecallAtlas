import { describe, expect, it } from 'vitest';
import { ordinal, presidentFacts } from './president-facts';

describe('presidentFacts', () => {
  it('formats a one-term president', () => {
    expect(presidentFacts({ numbers: [16], startYears: [1861], party: 'Republican' })).toEqual({
      numbers: '16th',
      years: '1861',
      party: 'Republican',
    });
  });

  it('shows both numbers and both years for non-consecutive terms', () => {
    expect(presidentFacts({ numbers: [22, 24], startYears: [1885, 1893], party: 'Democratic' })).toEqual({
      numbers: '22nd & 24th',
      years: '1885 & 1893',
      party: 'Democratic',
    });
  });

  it('keeps ordinals right in the teens', () => {
    expect([1, 2, 3, 11, 12, 13, 21, 22, 23].map(ordinal)).toEqual(['1st', '2nd', '3rd', '11th', '12th', '13th', '21st', '22nd', '23rd']);
  });
});
