import { getItem, type CourseDef } from '@/lib/engine';
import { groupFrames } from '@/lib/map/frames';
import type { MapSupport } from '@/lib/map/support';
import type { Presenter } from './present';
import type { MapView } from './types';

/**
 * World Capitals views (capitals spec §4). Country → capital shows the country and a locator map;
 * capital → country shows only the capital (a map or flag would give the answer away). Neither
 * names a country or capital outside its choice labels, beyond what the question asks.
 */
export function capitalsPresenter(
  course: CourseDef,
  deps: { flag: (key: string) => string; capitalNote: (key: string) => string | null; maps: MapSupport },
): Presenter {
  const { flag, capitalNote, maps } = deps;
  const name = (key: string) => getItem(course, key).name;
  const capital = (key: string) => getItem(course, key).answers!.capital.text;
  const locator = (frame: string, key: string, extra: Partial<MapView> = {}): MapView => {
    const data = maps.load(frame);
    return {
      baseUrl: `/maps/${frame}.svg`,
      width: data.width,
      height: data.height,
      highlight: data.countries[key]?.outline,
      locator: true,
      ...extra,
    };
  };

  return {
    prompt: (entry) =>
      entry.promptType === 'capital_to_country'
        ? { capital: capital(entry.itemKey), question: `${capital(entry.itemKey)} is the capital of…?`, asks: 'country' }
        : { name: name(entry.itemKey), question: `What's the capital of ${name(entry.itemKey)}?`, asks: 'capital' },

    choice: (key, format, promptType) => {
      // A mix-up is drilled by capital: "What's the capital of Slovakia?" Bratislava or Ljubljana.
      if (format === 'contrast') return { label: capital(key) };
      return { label: promptType === 'country_to_capital' ? capital(key) : name(key) };
    },

    item: (key) => {
      const note = capitalNote(key);
      return { name: name(key), flag: flag(key), capital: capital(key), ...(note ? { capitalNote: note } : {}) };
    },

    map(pending) {
      return pending.frame ? locator(pending.frame, pending.entry.itemKey) : undefined;
    },

    // Feedback shows the country on its region map in both directions, even when the question
    // itself had no map.
    feedbackMap(pending, grade) {
      const key = pending.entry.itemKey;
      const frame = pending.frame ?? groupFrames(getItem(course, key)).region;
      const data = maps.load(frame);
      const given = grade.answeredItemKey ? data.countries[grade.answeredItemKey]?.outline : undefined;
      return {
        baseUrl: `/maps/${frame}.svg`,
        width: data.width,
        height: data.height,
        correct: data.countries[key].outline,
        ...(given ? { given } : {}),
      };
    },
  };
}
