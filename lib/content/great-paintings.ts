import data from '@/content/paintings.json';
import type { CourseDef } from '@/lib/engine/types';
import { PAINTING_PROMPT_TYPES } from './painting-prompts';
import type { PaintingRecord } from './types';

const { paintings } = data as { paintings: PaintingRecord[] };
const byKey = new Map(paintings.map((p) => [p.key, p]));
const byRank = new Map(paintings.map((p) => [p.fame, p]));

/** Movement names in room (course-home) order. */
export const PAINTING_ROOMS: string[] = [...new Map(paintings.map((p) => [p.room, p.movement])).entries()]
  .sort(([a], [b]) => a - b)
  .map(([, name]) => name);

/**
 * About 246 public-domain paintings, one item each (spec §1). Every item shares one group order,
 * so the engine's "group, then item" order introduces them by fame across movements; `group` is the
 * movement (same-movement distractors), and `sequence` is the movement's neighbour index (level-3
 * movement options).
 */
export const GREAT_PAINTINGS: CourseDef = {
  slug: 'great-paintings',
  title: 'Great Paintings',
  placementPromptType: 'image_to_title',
  // Knowing the title shows the painting is known; its artist and movement are still taught, from level 2.
  placementGraduates: ['image_to_title', 'title_to_image'],
  placementHeadStart: 2,
  promptTypes: PAINTING_PROMPT_TYPES,
  items: paintings.map((p) => ({
    key: p.key,
    name: p.title,
    aliases: p.titleAliases,
    group: p.movement,
    groupOrder: 1,
    itemOrder: p.fame,
    lookalikes: p.lookalikes,
    sequence: [p.neighbour],
    answers: {
      artist: { text: p.artist, aliases: p.artistAliases },
      movement: { text: p.movement, aliases: p.alsoMovements },
    },
  })),
};

export function paintingRecord(key: string): PaintingRecord {
  const record = byKey.get(key);
  if (!record) throw new Error(`Unknown painting ${key}`);
  return record;
}

export function paintingByRank(rank: number): PaintingRecord | null {
  return byRank.get(rank) ?? null;
}
