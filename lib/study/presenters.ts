import 'server-only';
import { flagDataUri } from '@/lib/content/flag-art';
import { capitalNote, WORLD_MAP } from '@/lib/content/world-map';
import type { CourseDef } from '@/lib/engine';
import { loadFrame } from '@/lib/map/load';
import { mapSupport, type MapSupport } from '@/lib/map/support';
import { mapPresenter } from './map-presenter';
import { flagPresenter, type Presenter } from './present';

export function getMapSupport(course: CourseDef): MapSupport | undefined {
  return course.slug === WORLD_MAP.slug ? mapSupport(course, loadFrame) : undefined;
}

export function getPresenter(course: CourseDef): Presenter {
  switch (course.slug) {
    case 'world-flags':
      return flagPresenter(course, flagDataUri);
    case WORLD_MAP.slug:
      return mapPresenter(course, { flag: flagDataUri, capitalNote, maps: getMapSupport(course)! });
    default:
      throw new Error(`No presenter for course ${course.slug}`);
  }
}
