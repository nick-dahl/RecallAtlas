import { describe, expect, it } from 'vitest';
import { buildQuestion, gradeTyped, initialStates, newItemsInOrder, seededRng } from '@/lib/engine';
import { COURSE_BLURB } from '@/lib/ui/copy';
import { getCourse } from './registry';
import { GREAT_PAINTINGS, PAINTING_ROOMS, paintingByRank, paintingRecord } from './great-paintings';

const course = GREAT_PAINTINGS;
const item = (key: string) => course.items.find((i) => i.key === key)!;

describe('GREAT_PAINTINGS', () => {
  it('has four prompts and places on typed title, fast-tracking both title prompts', () => {
    expect(course.promptTypes.map((p) => p.id)).toEqual(['image_to_title', 'image_to_artist', 'title_to_image', 'image_to_movement']);
    expect(course.placementPromptType).toBe('image_to_title');
    expect(course.placementGraduates).toEqual(['image_to_title', 'title_to_image']);
    expect(getCourse('great-paintings')).toBe(course);
  });

  it('introduces paintings most famous first, across movements', () => {
    const order = newItemsInOrder(course, initialStates(course)).map((i) => i.key);
    expect(order.slice(0, 3)).toEqual(['mona-lisa', 'starry-night', 'last-supper']);
    expect(order.map((k) => paintingRecord(k).fame)).toEqual(order.map((_, i) => i + 1));
  });

  it('addresses reference images by rank and lists rooms in order', () => {
    expect(paintingByRank(1)?.key).toBe('mona-lisa');
    expect(paintingByRank(0)).toBeNull();
    expect(PAINTING_ROOMS[0]).toBe('Ancient & Medieval');
    expect(PAINTING_ROOMS.at(-1)).toBe('Abstraction');
  });

  it('never offers a boundary movement as a wrong answer', () => {
    for (let seed = 0; seed < 50; seed++) {
      for (const rung of [1, 2, 3] as const) {
        const q = buildQuestion({ entry: { kind: 'prompt', itemKey: 'olympia', promptType: 'image_to_movement' }, rung, course, confusions: [], rng: seededRng(seed) });
        const labels = q.choiceKeys!.filter((k) => k !== 'olympia').map((k) => item(k).answers!.movement.text);
        expect(labels).not.toContain('Impressionism');
        expect(new Set(labels).size).toBe(labels.length);
      }
    }
  });

  it('offers neighbouring movements at level 3', () => {
    const q = buildQuestion({ entry: { kind: 'prompt', itemKey: 'starry-night', promptType: 'image_to_movement' }, rung: 3, course, confusions: [], rng: seededRng(1) });
    const labels = q.choiceKeys!.map((k) => item(k).answers!.movement.text);
    expect(labels).toEqual(expect.arrayContaining(['Post-Impressionism', 'Impressionism', 'Symbolism & Art Nouveau']));
  });

  it('accepts artist short forms and Anonymous only where right', () => {
    const grade = (text: string, key: string) =>
      gradeTyped(text, item(key), course.items, 'artist', { ambiguous: course.promptTypes[1].ambiguous });
    expect(grade('van gogh', 'starry-night').correct).toBe(true);
    expect(grade('Leonardo', 'mona-lisa').correct).toBe(true);
    expect(grade('Unknown', 'lascaux').correct).toBe(true);
    expect(grade('Anonymous', 'mona-lisa')).toEqual({ correct: false, typo: false, answeredItemKey: null });
  });

  it('has a blurb with the real count', () => {
    expect(COURSE_BLURB['great-paintings']).toBe(`${course.items.length} of the world's great paintings: title, artist and movement.`);
  });

  it('passes a misspelled artist with several works as a typo, blaming nobody (review fix)', () => {
    const grade = (text: string, key: string) =>
      gradeTyped(text, item(key), course.items, 'artist', { ambiguous: course.promptTypes[1].ambiguous });
    for (const [text, key] of [['Rembrant', 'night-watch'], ['Vermer', 'milkmaid'], ['van Gough', 'starry-night'], ['Caravagio', 'calling-of-st-matthew'], ['Anonymus', 'lascaux']] as const) {
      expect(grade(text, key), `${text} on ${key}`).toEqual({ correct: true, typo: true, answeredItemKey: null });
    }
  });
});
