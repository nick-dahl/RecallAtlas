import { getItem, type CourseDef } from '@/lib/engine';
import type { MapSupport } from '@/lib/map/support';
import type { Presenter } from './present';
import type { MapView } from './types';

/**
 * World Map views (map spec §7). Leak rules: a Find question names only its target; Name and
 * Capital questions name no country except in choice labels, which always include distractors.
 * Map overlays are bare path data; candidates are keyed by opaque choice ids.
 */
export function mapPresenter(
  course: CourseDef,
  deps: { flag: (key: string) => string; capitalNote: (key: string) => string | null; maps: MapSupport },
): Presenter {
  const { flag, capitalNote, maps } = deps;
  const name = (key: string) => getItem(course, key).name;
  const capital = (key: string) => getItem(course, key).answers?.capital?.text;
  const base = (frame: string): MapView => {
    const { width, height } = maps.load(frame);
    return { baseUrl: `/maps/${frame}.svg`, width, height };
  };
  const shape = (frame: string, key: string) => maps.load(frame).countries[key];

  return {
    prompt: (entry) =>
      entry.promptType === 'find'
        ? { name: name(entry.itemKey) }
        : { question: entry.promptType === 'capital' ? "What's its capital?" : 'Which country is this?' },

    // Map-pick options are outlines on the map; a label would give the answer away.
    choice: (key, format, promptType) =>
      format === 'map-pick' ? {} : { label: promptType === 'capital' ? capital(key) : name(key) },

    item: (key) => {
      const note = capitalNote(key);
      return { name: name(key), flag: flag(key), capital: capital(key), ...(note ? { capitalNote: note } : {}) };
    },

    map(pending) {
      const { frame, entry } = pending;
      if (!frame) return undefined;
      if (pending.format === 'map-click') return base(frame);
      if (pending.format === 'map-pick' || entry.kind === 'contrast') {
        return {
          ...base(frame),
          candidates: pending.choices.map((c) => {
            const s = shape(frame, c.itemKey);
            return { id: c.id, d: s.outline, labelX: s.label[0], labelY: s.label[1] };
          }),
        };
      }
      return { ...base(frame), highlight: shape(frame, entry.itemKey).outline };
    },

    feedbackMap(pending, grade) {
      if (!pending.frame) return undefined;
      const given = grade.answeredItemKey ? shape(pending.frame, grade.answeredItemKey)?.outline : undefined;
      return {
        ...base(pending.frame),
        correct: shape(pending.frame, pending.entry.itemKey).outline,
        ...(given ? { given } : {}),
      };
    },
  };
}
