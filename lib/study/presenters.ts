import 'server-only';
import { flagDataUri } from '@/lib/content/flag-art';
import type { CourseDef } from '@/lib/engine';
import { flagPresenter, type Presenter } from './present';

export function getPresenter(course: CourseDef): Presenter {
  switch (course.slug) {
    case 'world-flags':
      return flagPresenter(course, flagDataUri);
    default:
      throw new Error(`No presenter for course ${course.slug}`);
  }
}
