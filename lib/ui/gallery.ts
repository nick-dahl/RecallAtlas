import type { Phase, TileState } from '@/lib/engine';
import type { PaintingRecord } from '@/lib/content/types';
import { masterySummary } from './mastery';

type Tile = { key: string; name: string; group: string; tile: TileState; prompts: { label: string; phase: Phase }[] };
export type WallTile = { rank: number; tile: TileState; label?: { title: string; artist: string }; summary: string };

/**
 * The gallery wall's rooms (movements, chronological) and tiles (by fame). A painting not yet
 * introduced is addressed only by rank and carries no title, artist or key: the wall is not a
 * cheat sheet.
 */
export function galleryRooms(tiles: readonly Tile[], records: readonly PaintingRecord[]): { movement: string; tiles: WallTile[] }[] {
  const byKey = new Map(records.map((r) => [r.key, r]));
  const rooms = new Map<number, { movement: string; tiles: WallTile[] }>();
  for (const t of tiles) {
    const r = byKey.get(t.key)!;
    const room = rooms.get(r.room) ?? { movement: r.movement, tiles: [] };
    const introduced = t.tile !== 'new';
    room.tiles.push({
      rank: r.fame,
      tile: t.tile,
      ...(introduced ? { label: { title: r.title, artist: r.artist } } : {}),
      summary: introduced ? masterySummary(r.title, t.prompts) : 'Not introduced yet',
    });
    rooms.set(r.room, room);
  }
  return [...rooms.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, room]) => ({ movement: room.movement, tiles: room.tiles.sort((a, b) => a.rank - b.rank) }));
}
