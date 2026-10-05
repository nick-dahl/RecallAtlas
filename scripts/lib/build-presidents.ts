import type { PresidentRecord } from '../../lib/content/types';
import { normalize } from '../../lib/engine/grading';
import type { PresidentEntry } from '../presidents-data';

/** Presidents within this many presidency numbers are era neighbours (look-alike candidates). */
const NEIGHBOUR_SPAN = 3;

const distance = (a: readonly number[], b: readonly number[]) =>
  Math.min(...a.flatMap((x) => b.map((y) => Math.abs(x - y))));

/**
 * Validates the reviewed president list (spec §3.6) and derives learning order and look-alikes.
 * Start years may repeat (1841, 1881); typed names may not.
 */
export function buildPresidents(
  entries: readonly PresidentEntry[],
  eras: readonly string[],
  facePairs: readonly [string, string][],
  sharedSpanPairs: readonly [string, string][],
  opts: { hasPortrait?: (key: string) => boolean; ambiguous?: readonly string[] } = {},
): PresidentRecord[] {
  const keys = new Set(entries.map((e) => e.key));
  if (keys.size !== entries.length) throw new Error('Duplicate president key');

  const numbers = entries.flatMap((e) => e.numbers).sort((a, b) => a - b);
  numbers.forEach((n, i) => {
    if (n !== i + 1) throw new Error(`Presidency numbers must cover 1–${numbers.length} once; problem at ${i + 1}`);
  });

  const nameOwner = new Map<string, string>();
  for (const e of entries) {
    if (e.numbers.length === 0) throw new Error(`${e.key} has no number`);
    if (e.startYears.length === 0) throw new Error(`${e.key} has no start year`);
    if (e.startYears.length !== e.numbers.length) throw new Error(`${e.key}: one start year per number`);
    if (!e.party) throw new Error(`${e.key} has no party`);
    if (!eras.includes(e.era)) throw new Error(`${e.key}: unknown era "${e.era}"`);
    if (opts.hasPortrait && !opts.hasPortrait(e.key)) throw new Error(`${e.key} has no portrait`);
    for (const n of new Set([e.name, ...e.aliases].map(normalize))) {
      const prev = nameOwner.get(n);
      if (prev && prev !== e.key) throw new Error(`Typed name "${n}" accepted by both ${prev} and ${e.key}`);
      nameOwner.set(n, e.key);
    }
  }
  for (const a of opts.ambiguous ?? []) {
    const owner = nameOwner.get(normalize(a));
    if (owner) throw new Error(`Ambiguous name "${a}" is accepted by ${owner}`);
  }
  for (const [a, b] of [...facePairs, ...sharedSpanPairs]) {
    for (const k of [a, b]) if (!keys.has(k)) throw new Error(`Pair references unknown president ${k}`);
  }

  const faces = new Map<string, string[]>();
  for (const [a, b] of facePairs) {
    faces.set(a, [...(faces.get(a) ?? []), b]);
    faces.set(b, [...(faces.get(b) ?? []), a]);
  }

  const chronological = [...entries].sort((a, b) => a.numbers[0] - b.numbers[0]);
  const counters = new Map<string, number>();
  return chronological.map((e) => {
    const itemOrder = (counters.get(e.era) ?? 0) + 1;
    counters.set(e.era, itemOrder);
    const neighbours = entries
      .filter((o) => o.key !== e.key && distance(o.numbers, e.numbers) <= NEIGHBOUR_SPAN)
      .sort((a, b) => distance(a.numbers, e.numbers) - distance(b.numbers, e.numbers) || a.numbers[0] - b.numbers[0])
      .map((o) => o.key);
    return {
      key: e.key,
      name: e.name,
      aliases: e.aliases,
      numbers: e.numbers,
      startYears: e.startYears,
      party: e.party,
      partyAliases: e.partyAliases ?? [],
      era: e.era,
      groupOrder: eras.indexOf(e.era) + 1,
      itemOrder,
      lookalikes: [...new Set([...neighbours, ...(faces.get(e.key) ?? [])])],
      wikipedia: e.wikipedia,
      ...(e.commonsFile ? { commonsFile: e.commonsFile } : {}),
    };
  });
}
