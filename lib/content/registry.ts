import type { CourseDef } from '@/lib/engine/types';
import { WORLD_FLAGS } from './world-flags';

const COURSES: Record<string, CourseDef> = {
  [WORLD_FLAGS.slug]: WORLD_FLAGS,
};

export function getCourse(slug: string): CourseDef | null {
  return COURSES[slug] ?? null;
}

export function listCourses(): CourseDef[] {
  return Object.values(COURSES);
}
