import type { CourseDef } from '@/lib/engine/types';
import { WORLD_FLAGS } from './world-flags';

const COURSES: Record<string, CourseDef> = {
  [WORLD_FLAGS.slug]: WORLD_FLAGS,
};

export function getCourse(slug: string): CourseDef | null {
  // Plain indexing (`COURSES[slug]`) resolves inherited keys like '__proto__' or 'toString'
  // via the prototype chain instead of returning undefined; hasOwn restricts to real entries.
  return Object.hasOwn(COURSES, slug) ? COURSES[slug] : null;
}

export function listCourses(): CourseDef[] {
  return Object.values(COURSES);
}
