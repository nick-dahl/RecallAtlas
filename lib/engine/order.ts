import { getItem } from './state';
import type { CourseDef } from './types';

/** A put-in-order answer is correct only if every item comes after the one before it (first positions). */
export function gradeOrder(keys: readonly string[], course: CourseDef): boolean {
  const firsts = keys.map((key) => {
    const sequence = getItem(course, key).sequence;
    if (!sequence?.length) throw new Error(`Item ${key} has no sequence`);
    return sequence[0];
  });
  return firsts.every((n, i) => i === 0 || n > firsts[i - 1]);
}
