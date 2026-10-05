import { confusedWith } from './confusion';
import { shuffle } from './random';
import type { Confusion, DistractorMode, Item, Rng } from './types';

export function pickDistractors(args: {
  target: Item;
  items: readonly Item[];
  count: number;
  mode: DistractorMode;
  confusions: readonly Confusion[];
  rng: Rng;
  /** Restricts candidates (e.g. to countries drawn in a map frame). */
  eligible?: (key: string) => boolean;
}): string[] {
  const { target, items, count, mode, confusions, rng, eligible } = args;
  const pool = items.filter((i) => i.key !== target.key && (eligible?.(i.key) ?? true));
  const valid = new Set(pool.map((i) => i.key));
  const sameGroup = pool.filter((i) => i.group === target.group);
  const otherGroups = pool.filter((i) => i.group !== target.group);

  const ordered =
    mode === 'hard'
      ? [
          ...confusedWith(confusions, target.key),
          ...target.lookalikes,
          ...shuffle(sameGroup, rng).map((i) => i.key),
          ...shuffle(pool, rng).map((i) => i.key),
        ]
      : mode === 'local'
        ? [...shuffle(sameGroup, rng), ...shuffle(otherGroups, rng)].map((i) => i.key)
        : [...shuffle(otherGroups, rng), ...shuffle(sameGroup, rng)].map((i) => i.key);

  return [...new Set(ordered.filter((k) => valid.has(k)))].slice(0, count);
}
