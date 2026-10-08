import { describe, expect, it } from 'vitest';
import { GREAT_PAINTINGS, paintingByRank, paintingRecord } from '@/lib/content/great-paintings';
import { galleryRooms } from './gallery';

const tiles = GREAT_PAINTINGS.items.map((i) => ({
  key: i.key,
  name: i.name,
  group: i.group,
  tile: i.key === 'mona-lisa' ? ('learning-1' as const) : ('new' as const),
  prompts: [{ label: 'Title', phase: 'new' as const }],
}));
const rooms = galleryRooms(tiles, GREAT_PAINTINGS.items.map((i) => paintingRecord(i.key)));

describe('galleryRooms (Review Focus 4)', () => {
  it('puts every painting in its movement room, rooms in chronological order', () => {
    expect(rooms[0].movement).toBe('Ancient & Medieval');
    expect(rooms.at(-1)!.movement).toBe('Abstraction');
    expect(rooms.flatMap((r) => r.tiles)).toHaveLength(GREAT_PAINTINGS.items.length);
  });

  it('labels introduced paintings and reveals nothing about new ones', () => {
    const all = rooms.flatMap((r) => r.tiles);
    expect(all.find((t) => t.rank === 1)!.label).toEqual({ title: 'Mona Lisa', artist: 'Leonardo da Vinci' });
    for (const t of all.filter((t) => t.rank !== 1)) {
      const r = paintingByRank(t.rank)!;
      expect(t.label).toBeUndefined();
      expect(t.summary).toBe('Not introduced yet');
      expect(JSON.stringify(t)).not.toContain(`"${r.key}"`);
      expect(JSON.stringify(t)).not.toContain(r.title);
    }
  });
});
