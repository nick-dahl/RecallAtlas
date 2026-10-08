import { describe, expect, it } from 'vitest';
import { buildPaintings } from './build-paintings';
import { ARTISTS, MOVEMENTS, PAINTINGS, SUBJECT_PAIRS, type PaintingEntry } from '../paintings-data';

const MOVES = [{ name: 'Baroque', neighbour: 7 }, { name: 'Dutch Golden Age', neighbour: 8 }];
const ARTS = { Rembrandt: [], 'Johannes Vermeer': ['Vermeer'], Anonymous: ['Unknown'] };
const e = (over: Partial<PaintingEntry>): PaintingEntry => ({
  key: 'night-watch', title: 'The Night Watch', artist: 'Rembrandt', year: '1642', movement: 'Dutch Golden Age',
  museum: 'Rijksmuseum, Amsterdam', fame: 1, wikipedia: 'The_Night_Watch', ...over,
});
const build = (entries: PaintingEntry[], extra: Partial<Parameters<typeof buildPaintings>[1]> = {}) =>
  buildPaintings(entries, { movements: MOVES, artists: ARTS, subjectPairs: [], minPerMovement: 0, ...extra });

describe('buildPaintings', () => {
  it('derives room, neighbour, artist aliases and same-artist look-alikes', () => {
    const [nw, tulp] = build([e({}), e({ key: 'tulp', title: 'The Anatomy Lesson of Dr Nicolaes Tulp', fame: 2 })]);
    expect(nw).toMatchObject({ room: 1, neighbour: 8, artistAliases: [], lookalikes: ['tulp'], detail: false });
    expect(tulp.lookalikes).toEqual(['night-watch']);
  });

  it('rejects duplicate titles, also through aliases and leading articles', () => {
    expect(() => build([e({}), e({ key: 'x', title: 'Night Watch', fame: 2 })])).toThrow(/title/i);
    expect(() => build([e({}), e({ key: 'x', title: 'Other', titleAliases: ['the night watch'], fame: 2 })])).toThrow(/title/i);
  });

  it('enforces the caps: 4 per named artist, 8 anonymous, a minimum per movement', () => {
    const five = Array.from({ length: 5 }, (_, i) => e({ key: `r${i}`, title: `R ${i}`, fame: i + 1 }));
    expect(() => build(five)).toThrow(/Rembrandt.*5/);
    const nine = Array.from({ length: 9 }, (_, i) => e({ key: `a${i}`, title: `A ${i}`, artist: 'Anonymous', fame: i + 1 }));
    expect(() => build(nine)).toThrow(/anonymous/i);
    expect(() => build([e({})], { minPerMovement: 2 })).toThrow(/Baroque|Dutch/);
  });

  it('rejects unknown movements and artists, a boundary movement equal to its own, and works after 1930', () => {
    expect(() => build([e({ movement: 'Pop Art' })])).toThrow(/movement/);
    expect(() => build([e({ artist: 'Picasso' })])).toThrow(/artist/);
    expect(() => build([e({ alsoMovements: ['Dutch Golden Age'] })])).toThrow(/boundary/);
    expect(() => build([e({ year: '1931' })])).toThrow(/1930/);
  });

  it('rejects fame ranks that are not exactly 1..N', () => {
    expect(() => build([e({}), e({ key: 'x', title: 'X', fame: 3 })])).toThrow(/fame/);
  });

  it('checks images when asked, and adds subject pairs as look-alikes', () => {
    expect(() => build([e({})], { hasImage: () => false })).toThrow(/image/);
    const [a, b] = build([e({}), e({ key: 'milk', title: 'The Milkmaid', artist: 'Johannes Vermeer', fame: 2 })], { subjectPairs: [['night-watch', 'milk']] });
    expect(a.lookalikes).toEqual(['milk']);
    expect(b.lookalikes).toEqual(['night-watch']);
  });

  it('validates the real list', () => {
    const records = buildPaintings(PAINTINGS, { movements: MOVEMENTS, artists: ARTISTS, subjectPairs: SUBJECT_PAIRS });
    expect(records.length).toBe(246);
    expect(records.filter((r) => r.artist === 'Anonymous').length).toBe(8);
  });
});
