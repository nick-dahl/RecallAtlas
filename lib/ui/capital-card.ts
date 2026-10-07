import type { TileState } from '@/lib/engine';

/** A capitals course-home card's capital: hidden as "?" until the country has been introduced. */
export function capitalCardText(tile: TileState, capital: string): string {
  return tile === 'new' ? '?' : capital;
}
