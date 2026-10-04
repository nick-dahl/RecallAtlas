import type { TileState } from '@/lib/engine';

/** The album fills with color as flags are learned; mastered flags get a gold ring. */
export const TILE_STYLE: Record<TileState, { filter: string; ring?: boolean; label: string }> = {
  new: { filter: 'grayscale(1) opacity(0.45)', label: 'Not started' },
  'learning-1': { filter: 'grayscale(0.8)', label: 'Learning' },
  'learning-2': { filter: 'grayscale(0.5)', label: 'Learning' },
  'learning-3': { filter: 'grayscale(0.2)', label: 'Almost there' },
  review: { filter: 'none', label: 'Learned' },
  strong: { filter: 'none', ring: true, label: 'Mastered' },
};

export function groupTiles<T extends { group: string }>(tiles: readonly T[]): { group: string; tiles: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const t of tiles) groups.set(t.group, [...(groups.get(t.group) ?? []), t]);
  return [...groups].map(([group, list]) => ({ group, tiles: list }));
}

export function albumSummary(tiles: readonly { tile: TileState }[]) {
  const summary = { new: 0, learning: 0, learned: 0 };
  for (const { tile } of tiles) {
    if (tile === 'new') summary.new++;
    else if (tile === 'review' || tile === 'strong') summary.learned++;
    else summary.learning++;
  }
  return summary;
}
