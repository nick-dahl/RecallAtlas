import { getItem, type CourseDef, type QueueEntry, type QuestionRung } from '@/lib/engine';
import { frameFor, groupFrames } from './frames';
import type { FrameData } from './types';

/** What the services need to ask and grade questions on a map. */
export interface MapSupport {
  /** The frame a question is asked on, chosen at issue time; undefined = no map. */
  frameFor(entry: QueueEntry, rung: QuestionRung): string | undefined;
  load(frameId: string): FrameData;
}

export function mapSupport(
  course: CourseDef,
  load: (frameId: string) => FrameData,
  opts: { mapless?: (entry: QueueEntry) => boolean } = {},
): MapSupport {
  return {
    load,
    frameFor(entry, rung) {
      // Some questions must not show a map (it would reveal the answer).
      if (opts.mapless?.(entry)) return undefined;
      const item = getItem(course, entry.itemKey);
      if (entry.kind !== 'contrast') return frameFor(item, entry.kind === 'prompt' ? entry.promptType : null, rung);
      // A confusion can span regions (a click on the continent map): use the first frame
      // that shows both countries, or no map at all.
      const other = getItem(course, entry.otherKey);
      const candidates = [...Object.values(groupFrames(item)), ...Object.values(groupFrames(other))];
      return candidates.find((id) => {
        const { countries } = load(id);
        return Object.hasOwn(countries, item.key) && Object.hasOwn(countries, other.key);
      });
    },
  };
}

/** Countries a question on this frame may offer as candidates: drawn, and not a sliver. */
export function shownIn(frame: FrameData): (key: string) => boolean {
  return (key) => Object.hasOwn(frame.countries, key) && !frame.countries[key].sliver;
}
