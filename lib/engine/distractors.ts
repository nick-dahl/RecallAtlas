import { confusedWith } from './confusion';
import { normalize } from './grading';
import { shuffle } from './random';
import type { Confusion, DistractorMode, Item, Rng } from './types';

/** Smallest distance between any of two items' sequence positions. */
function sequenceDistance(a: Item, b: Item): number {
  return Math.min(...(a.sequence ?? []).flatMap((x) => (b.sequence ?? []).map((y) => Math.abs(x - y))));
}

export function pickDistractors(args: {
  target: Item;
  items: readonly Item[];
  count: number;
  mode: DistractorMode;
  confusions: readonly Confusion[];
  rng: Rng;
  /** Restricts candidates (e.g. to countries drawn in a map frame). */
  eligible?: (key: string) => boolean;
  /** Options must show distinct labels, none of them in `taken` (the target's accepted answers). */
  distinct?: { label: (item: Item) => string; taken: readonly string[] };
  /** `sequence` mode: only items within this many positions of the target. */
  window?: number;
  /** Pairs never chosen together, nor with the target (e.g. presidents sharing a span). */
  exclusions?: readonly [string, string][];
}): string[] {
  const { target, items, count, confusions, rng, eligible, distinct, window, exclusions } = args;
  const mode = args.mode === 'sequence' && !target.sequence?.length ? 'local' : args.mode;
  const pool = items.filter((i) => i.key !== target.key && (eligible?.(i.key) ?? true));
  const valid = new Set(pool.map((i) => i.key));
  const sameGroup = pool.filter((i) => i.group === target.group);
  const otherGroups = pool.filter((i) => i.group !== target.group);

  const ordered =
    mode === 'sequence'
      ? pool
          .filter((i) => i.sequence?.length && (window === undefined || sequenceDistance(i, target) <= window))
          .sort((a, b) => sequenceDistance(a, target) - sequenceDistance(b, target) || a.sequence![0] - b.sequence![0])
          .map((i) => i.key)
      : mode === 'hard'
      ? [
          ...confusedWith(confusions, target.key),
          ...target.lookalikes,
          ...shuffle(sameGroup, rng).map((i) => i.key),
          ...shuffle(pool, rng).map((i) => i.key),
        ]
      : mode === 'local'
        ? [...shuffle(sameGroup, rng), ...shuffle(otherGroups, rng)].map((i) => i.key)
        : [...shuffle(otherGroups, rng), ...shuffle(sameGroup, rng)].map((i) => i.key);

  const byKey = new Map(pool.map((i) => [i.key, i]));
  const excluded = (a: string, b: string) =>
    (exclusions ?? []).some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const taken = new Set((distinct?.taken ?? []).map(normalize));
  const chosen: string[] = [];
  for (const key of new Set(ordered.filter((k) => valid.has(k)))) {
    if (chosen.length === count) break;
    if ([target.key, ...chosen].some((other) => excluded(key, other))) continue;
    if (distinct) {
      const label = normalize(distinct.label(byKey.get(key)!));
      if (taken.has(label)) continue;
      taken.add(label);
    }
    chosen.push(key);
  }
  return chosen;
}
