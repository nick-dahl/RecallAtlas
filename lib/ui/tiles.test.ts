import { describe, expect, it } from 'vitest';
import { albumSummary, groupTiles, TILE_STYLE } from './tiles';

const tiles = [
  { key: 'A', name: 'A', group: 'Europe', tile: 'new' as const },
  { key: 'B', name: 'B', group: 'Europe', tile: 'review' as const },
  { key: 'C', name: 'C', group: 'Asia', tile: 'learning-2' as const },
  { key: 'D', name: 'D', group: 'Europe', tile: 'strong' as const },
];

describe('tiles', () => {
  it('groups in order of first appearance', () => {
    expect(groupTiles(tiles).map((g) => [g.group, g.tiles.map((t) => t.key)])).toEqual([
      ['Europe', ['A', 'B', 'D']],
      ['Asia', ['C']],
    ]);
  });

  it('summarizes the album', () => {
    expect(albumSummary(tiles)).toEqual({ new: 1, learning: 1, learned: 2 });
  });

  it('desaturates unlearned tiles and rings mastered ones', () => {
    expect(TILE_STYLE.new.filter).toContain('grayscale(1)');
    expect(TILE_STYLE.review.filter).toBe('none');
    expect(TILE_STYLE.strong.ring).toBe(true);
  });
});
