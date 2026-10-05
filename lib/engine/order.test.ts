import { describe, expect, it } from 'vitest';
import { gradeOrder } from './order';
import { TEST_COURSE, TEST_SEQ_COURSE } from './test-fixtures';

describe('gradeOrder', () => {
  it('is correct only when items are in ascending order of their first number', () => {
    expect(gradeOrder(['s1', 's2', 's3', 's5'], TEST_SEQ_COURSE)).toBe(true);
    expect(gradeOrder(['s2', 's1', 's3', 's5'], TEST_SEQ_COURSE)).toBe(false);
    expect(gradeOrder(['s5', 's6', 's7', 's8'], TEST_SEQ_COURSE)).toBe(true);
  });

  it('refuses items without a sequence', () => {
    expect(() => gradeOrder(['US', 'EC'], TEST_COURSE)).toThrow(/sequence/);
  });
});
