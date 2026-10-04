import { describe, expect, it } from 'vitest';
import { getCourse, listCourses } from './registry';
import { WORLD_FLAGS } from './world-flags';

describe('getCourse', () => {
  it('returns the course for a known slug', () => {
    expect(getCourse(WORLD_FLAGS.slug)).toBe(WORLD_FLAGS);
  });

  it('returns null for an unknown slug', () => {
    expect(getCourse('not-a-real-course')).toBeNull();
  });

  it.each(['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf'])(
    'returns null for the inherited Object.prototype property %s',
    (slug) => {
      expect(getCourse(slug)).toBeNull();
    },
  );
});

describe('listCourses', () => {
  it('includes world-flags', () => {
    expect(listCourses()).toContain(WORLD_FLAGS);
  });
});
