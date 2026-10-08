import { getItem, type CourseDef } from '@/lib/engine';
import { paintingRecord } from '@/lib/content/great-paintings';
import type { Presenter } from './present';

/**
 * Great Paintings views (spec §4.6). Image questions show the painting and name nothing outside
 * choice labels; Title → image names only the title, over unlabelled thumbnails.
 */
export function paintingsPresenter(course: CourseDef, deps: { image: (key: string, size: 'large' | 'thumb') => string }): Presenter {
  const { image } = deps;
  const title = (key: string) => getItem(course, key).name;
  const shown = (key: string) => ({ painting: image(key, 'large'), ...(paintingRecord(key).detail ? { detail: true } : {}) });

  return {
    prompt(entry) {
      const key = entry.itemKey;
      switch (entry.promptType) {
        case 'image_to_artist':
          return { ...shown(key), question: 'Who painted this?', asks: 'artist' };
        case 'image_to_movement':
          return { ...shown(key), question: 'Which movement or period is this?', asks: 'movement' };
        case 'title_to_image':
          return { name: title(key), question: `Which one is ${title(key)}?` };
        default:
          return { ...shown(key), question: 'What is this painting called?', asks: 'title' };
      }
    },

    choice(key, format, promptType) {
      if (format === 'image-grid') return { painting: image(key, 'thumb') };
      if (format === 'contrast') return { label: title(key), painting: image(key, 'thumb') };
      if (promptType === 'image_to_artist') return { label: paintingRecord(key).artist };
      if (promptType === 'image_to_movement') return { label: paintingRecord(key).movement };
      return { label: title(key) };
    },

    item(key) {
      const r = paintingRecord(key);
      return {
        name: r.title,
        painting: image(key, 'large'),
        ...(r.detail ? { detail: true } : {}),
        artist: r.artist,
        year: r.year,
        movement: r.movement,
        museum: r.museum,
      };
    },
  };
}
