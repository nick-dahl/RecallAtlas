import type { PaintingRecord } from '../../lib/content/types';
import { normalize } from '../../lib/engine/grading';
import type { PaintingEntry } from '../paintings-data';

const MAX_PER_ARTIST = 4;
const MAX_ANONYMOUS = 8;
const LAST_YEAR = 1930;

/** Validates the reviewed list (spec §3.6) and derives rooms, neighbours and look-alikes. */
export function buildPaintings(
  entries: readonly PaintingEntry[],
  opts: {
    movements: readonly { name: string; neighbour: number }[];
    artists: Record<string, readonly string[]>;
    subjectPairs: readonly [string, string][];
    minPerMovement?: number;
    hasImage?: (key: string) => boolean;
  },
): PaintingRecord[] {
  const { movements, artists, subjectPairs } = opts;
  const roomOf = new Map(movements.map((m, i) => [m.name, i]));
  const keys = new Set(entries.map((e) => e.key));
  if (keys.size !== entries.length) throw new Error('Duplicate painting key');

  const fames = entries.map((e) => e.fame).sort((a, b) => a - b);
  fames.forEach((f, i) => {
    if (f !== i + 1) throw new Error(`fame ranks must be exactly 1–${entries.length}; problem at ${i + 1}`);
  });

  const artistOwner = new Map<string, string>();
  for (const [artist, aliases] of Object.entries(artists)) {
    for (const form of new Set([artist, ...aliases].map(normalize))) {
      const prev = artistOwner.get(form);
      if (prev && prev !== artist) throw new Error(`Artist form "${form}" accepted for both ${prev} and ${artist}`);
      artistOwner.set(form, artist);
    }
  }

  const titleOwner = new Map<string, string>();
  const perArtist = new Map<string, number>();
  for (const e of entries) {
    if (!roomOf.has(e.movement)) throw new Error(`${e.key}: unknown movement "${e.movement}"`);
    for (const m of e.alsoMovements ?? []) {
      if (!roomOf.has(m) || m === e.movement) throw new Error(`${e.key}: bad boundary movement "${m}"`);
    }
    if (!Object.hasOwn(artists, e.artist)) throw new Error(`${e.key}: unknown artist "${e.artist}"`);
    perArtist.set(e.artist, (perArtist.get(e.artist) ?? 0) + 1);
    const years = [...e.year.matchAll(/\b(\d{4})\b/g)].map((m) => Number(m[1]));
    if (years.some((y) => y > LAST_YEAR)) throw new Error(`${e.key}: dated after ${LAST_YEAR}`);
    if (opts.hasImage && !opts.hasImage(e.key)) throw new Error(`${e.key} has no image within budget`);
    for (const t of new Set([e.title, ...(e.titleAliases ?? [])].map(normalize))) {
      const prev = titleOwner.get(t);
      if (prev && prev !== e.key) throw new Error(`Typed title "${t}" accepted by both ${prev} and ${e.key}`);
      titleOwner.set(t, e.key);
    }
  }
  for (const [artist, n] of perArtist) {
    if (artist === 'Anonymous' ? n > MAX_ANONYMOUS : n > MAX_PER_ARTIST) {
      throw new Error(
        artist === 'Anonymous' ? `${n} anonymous works (max ${MAX_ANONYMOUS})` : `${artist} has ${n} works (max ${MAX_PER_ARTIST})`,
      );
    }
  }
  for (const m of movements) {
    const n = entries.filter((e) => e.movement === m.name).length;
    if (n < (opts.minPerMovement ?? 6)) throw new Error(`${m.name} has only ${n} works`);
  }
  for (const [a, b] of subjectPairs) {
    for (const k of [a, b]) if (!keys.has(k)) throw new Error(`Subject pair references unknown painting ${k}`);
  }

  const pairs = new Map<string, string[]>();
  for (const [a, b] of subjectPairs) {
    pairs.set(a, [...(pairs.get(a) ?? []), b]);
    pairs.set(b, [...(pairs.get(b) ?? []), a]);
  }
  return [...entries]
    .sort((a, b) => a.fame - b.fame)
    .map((e) => {
      const sameArtist =
        e.artist === 'Anonymous' ? [] : entries.filter((o) => o.key !== e.key && o.artist === e.artist).map((o) => o.key);
      const room = roomOf.get(e.movement)!;
      return {
        key: e.key,
        title: e.title,
        titleAliases: e.titleAliases ?? [],
        artist: e.artist,
        artistAliases: [...(artists[e.artist] ?? [])],
        year: e.year,
        movement: e.movement,
        alsoMovements: e.alsoMovements ?? [],
        museum: e.museum,
        fame: e.fame,
        room,
        neighbour: movements[room].neighbour,
        lookalikes: [...new Set([...sameArtist, ...(pairs.get(e.key) ?? [])])],
        detail: Boolean(e.crop),
      };
    });
}
