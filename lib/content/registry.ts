import type { CourseDef } from '@/lib/engine/types';
import { GREAT_PAINTINGS } from './great-paintings';
import { US_PRESIDENTS } from './us-presidents';
import { WORLD_CAPITALS } from './world-capitals';
import { WORLD_FLAGS } from './world-flags';
import { WORLD_MAP } from './world-map';

const COURSES: Record<string, CourseDef> = {
  [WORLD_FLAGS.slug]: WORLD_FLAGS,
  [WORLD_MAP.slug]: WORLD_MAP,
  [US_PRESIDENTS.slug]: US_PRESIDENTS,
  [WORLD_CAPITALS.slug]: WORLD_CAPITALS,
  [GREAT_PAINTINGS.slug]: GREAT_PAINTINGS,
};

export function getCourse(slug: string): CourseDef | null {
  // Plain indexing (`COURSES[slug]`) resolves inherited keys like '__proto__' or 'toString'
  // via the prototype chain instead of returning undefined; hasOwn restricts to real entries.
  return Object.hasOwn(COURSES, slug) ? COURSES[slug] : null;
}

export function listCourses(): CourseDef[] {
  return Object.values(COURSES);
}
