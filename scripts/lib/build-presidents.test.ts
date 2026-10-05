import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalize } from '../../lib/engine/grading';
import { AMBIGUOUS_NAMES, ERAS, FACE_LOOKALIKE_PAIRS, PRESIDENTS, SHARED_SPAN_PAIRS, type PresidentEntry } from '../presidents-data';
import { buildPresidents } from './build-presidents';

const records = buildPresidents(PRESIDENTS, ERAS, FACE_LOOKALIKE_PAIRS, SHARED_SPAN_PAIRS, { ambiguous: AMBIGUOUS_NAMES });
const byKey = new Map(records.map((r) => [r.key, r]));

describe('buildPresidents (real data)', () => {
  it('has 45 presidents covering presidencies 1–47 exactly once', () => {
    expect(records).toHaveLength(45);
    expect(records.flatMap((r) => r.numbers).sort((a, b) => a - b)).toEqual(Array.from({ length: 47 }, (_, i) => i + 1));
  });

  it('orders items chronologically within 8 eras of 5–6 presidents', () => {
    expect(new Set(records.map((r) => r.groupOrder))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8]));
    for (const era of ERAS) {
      const members = records.filter((r) => r.era === era);
      expect(members.length).toBeGreaterThanOrEqual(5);
      expect(members.length).toBeLessThanOrEqual(6);
      const byOrder = [...members].sort((a, b) => a.itemOrder - b.itemOrder);
      expect(byOrder.map((r) => r.itemOrder)).toEqual(members.map((_, i) => i + 1));
      expect(byOrder.map((r) => r.numbers[0])).toEqual([...byOrder.map((r) => r.numbers[0])].sort((a, b) => a - b));
    }
    expect(byKey.get('washington')).toMatchObject({ groupOrder: 1, itemOrder: 1 });
    expect(byKey.get('biden')).toMatchObject({ era: 'Modern era', itemOrder: 5 });
  });

  it('never accepts a bare shared surname', () => {
    for (const surname of ['adams', 'harrison', 'johnson', 'roosevelt', 'bush']) {
      for (const r of records) expect([r.name, ...r.aliases].map(normalize)).not.toContain(surname);
    }
  });

  it('has no typed name accepted by two presidents', () => {
    const owner = new Map<string, string>();
    for (const r of records) {
      for (const n of new Set([r.name, ...r.aliases].map(normalize))) {
        expect(owner.get(n) ?? r.key).toBe(r.key);
        owner.set(n, r.key);
      }
    }
  });

  it('lists era neighbours first (nearest number first), then face look-alikes', () => {
    expect(byKey.get('polk')!.lookalikes.slice(0, 2).sort()).toEqual(['taylor', 'tyler']);
    expect(byKey.get('arthur')!.lookalikes).toContain('hayes');
    expect(byKey.get('hayes')!.lookalikes).toContain('arthur');
    for (const r of records) expect(r.lookalikes).not.toContain(r.key);
  });

  it('keeps the party rulings and the two-term presidents', () => {
    expect(byKey.get('washington')!.party).toBe('No party');
    expect(byKey.get('tyler')!.party).toBe('Whig');
    expect(byKey.get('a-johnson')).toMatchObject({ party: 'National Union', partyAliases: ['Democratic'] });
    expect(byKey.get('lincoln')).toMatchObject({ party: 'Republican', partyAliases: ['National Union'] });
    expect(byKey.get('cleveland')).toMatchObject({ numbers: [22, 24], startYears: [1885, 1893] });
    expect(byKey.get('trump')).toMatchObject({ numbers: [45, 47], startYears: [2017, 2025] });
  });

  it('matches the committed content/presidents.json (run `npm run content:build` if this fails)', () => {
    const committed = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content', 'presidents.json'), 'utf8'));
    expect(committed).toEqual({ presidents: records, orderExclusions: SHARED_SPAN_PAIRS, ambiguousAnswers: AMBIGUOUS_NAMES });
  });
});

const entry = (over: Partial<PresidentEntry>): PresidentEntry => ({
  key: 'a',
  name: 'Alpha One',
  aliases: [],
  numbers: [1],
  startYears: [1801],
  party: 'P',
  era: 'Founding era',
  wikipedia: 'A',
  ...over,
});
const two = [entry({}), entry({ key: 'b', name: 'Bravo Two', numbers: [2], startYears: [1801] })];

describe('buildPresidents (validation)', () => {
  it('accepts shared start years', () => {
    expect(buildPresidents(two, ERAS, [], [])).toHaveLength(2);
  });

  it('throws on a gap or duplicate in the numbers', () => {
    expect(() => buildPresidents([two[0], { ...two[1], numbers: [3] }], ERAS, [], [])).toThrow(/2/);
    expect(() => buildPresidents([two[0], { ...two[1], numbers: [1] }], ERAS, [], [])).toThrow(/1/);
  });

  it('throws on a typed name shared by two presidents', () => {
    expect(() => buildPresidents([two[0], { ...two[1], aliases: ['Alpha One'] }], ERAS, [], [])).toThrow(/alpha one/);
  });

  it('throws on a missing party or start year', () => {
    expect(() => buildPresidents([{ ...two[0], party: '' }, two[1]], ERAS, [], [])).toThrow(/party/);
    expect(() => buildPresidents([{ ...two[0], startYears: [] }, two[1]], ERAS, [], [])).toThrow(/start year/);
  });

  it('throws on an unknown look-alike or exclusion key', () => {
    expect(() => buildPresidents(two, ERAS, [['a', 'zz']], [])).toThrow(/zz/);
    expect(() => buildPresidents(two, ERAS, [], [['a', 'yy']])).toThrow(/yy/);
  });

  it('throws when an ambiguous name is accepted by a president', () => {
    expect(() => buildPresidents(two, ERAS, [], [], { ambiguous: ['Alpha One'] })).toThrow(/Ambiguous.*a/);
  });

  it('throws on a missing portrait when a portrait check is given', () => {
    expect(() => buildPresidents(two, ERAS, [], [], { hasPortrait: (k) => k !== 'b' })).toThrow(/portrait.*b|b.*portrait/);
  });
});
