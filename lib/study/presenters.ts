import 'server-only';
import { flagDataUri } from '@/lib/content/flag-art';
import { portraitDataUri } from '@/lib/content/portrait-art';
import { US_PRESIDENTS } from '@/lib/content/us-presidents';
import { capitalNote } from '@/lib/content/capitals';
import { WORLD_CAPITALS } from '@/lib/content/world-capitals';
import { WORLD_MAP } from '@/lib/content/world-map';
import type { CourseDef } from '@/lib/engine';
import { loadFrame } from '@/lib/map/load';
import { mapSupport, type MapSupport } from '@/lib/map/support';
import { capitalsPresenter } from './capitals-presenter';
import { mapPresenter } from './map-presenter';
import { flagPresenter, type Presenter } from './present';
import { presidentsPresenter } from './presidents-presenter';

export function getMapSupport(course: CourseDef): MapSupport | undefined {
  if (course.slug === WORLD_MAP.slug) return mapSupport(course, loadFrame);
  if (course.slug === WORLD_CAPITALS.slug) {
    // Capital → country and contrast drills show no map: it would reveal the answer.
    return mapSupport(course, loadFrame, {
      mapless: (entry) => entry.kind === 'contrast' || (entry.kind === 'prompt' && entry.promptType === 'capital_to_country'),
    });
  }
  return undefined;
}

export function getPresenter(course: CourseDef): Presenter {
  switch (course.slug) {
    case 'world-flags':
      return flagPresenter(course, flagDataUri);
    case WORLD_MAP.slug:
      return mapPresenter(course, { flag: flagDataUri, maps: getMapSupport(course)! });
    case WORLD_CAPITALS.slug:
      return capitalsPresenter(course, { flag: flagDataUri, capitalNote, maps: getMapSupport(course)! });
    case US_PRESIDENTS.slug:
      return presidentsPresenter(course, { portrait: portraitDataUri });
    default:
      throw new Error(`No presenter for course ${course.slug}`);
  }
}
