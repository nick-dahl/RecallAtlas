import { describe, expect, it } from 'vitest';
import { pickDistractors } from './distractors';
import { seededRng } from './random';
import { fixtureItem, ITEMS, TEST_SEQ_COURSE } from './test-fixtures';

describe('pickDistractors', () => {
  it('hard mode puts personal confusions first, then static lookalikes', () => {
    const picks = pickDistractors({
      target: fixtureItem('EC'),
      items: ITEMS,
      count: 3,
      mode: 'hard',
      confusions: [{ asked: 'EC', answered: 'PE', count: 2 }],
      rng: seededRng(1),
    });
    expect(picks).toEqual(['PE', 'CO', 'VE']);
  });

  it('random mode prefers items from other groups', () => {
    const southAmerica = new Set(['EC', 'CO', 'VE', 'PE']);
    const picks = pickDistractors({
      target: fixtureItem('EC'),
      items: ITEMS,
      count: 5,
      mode: 'random',
      confusions: [],
      rng: seededRng(2),
    });
    expect(picks).toHaveLength(5);
    expect(picks.some((k) => southAmerica.has(k))).toBe(false);
  });

  it('never includes the target, never repeats, and caps at pool size', () => {
    for (const mode of ['hard', 'random'] as const) {
      const picks = pickDistractors({
        target: fixtureItem('TD'),
        items: ITEMS,
        count: 50,
        mode,
        confusions: [],
        rng: seededRng(3),
      });
      expect(picks).toHaveLength(ITEMS.length - 1);
      expect(new Set(picks).size).toBe(picks.length);
      expect(picks).not.toContain('TD');
    }
  });

  it('is deterministic for a given seed', () => {
    const args = { target: fixtureItem('US'), items: ITEMS, count: 4, mode: 'random' as const, confusions: [] };
    expect(pickDistractors({ ...args, rng: seededRng(5) })).toEqual(pickDistractors({ ...args, rng: seededRng(5) }));
  });
});

describe('pickDistractors for maps', () => {
  it('local mode prefers the same group', () => {
    const d = pickDistractors({ target: fixtureItem('EC'), items: ITEMS, count: 3, mode: 'local', confusions: [], rng: seededRng(1) });
    expect(new Set(d)).toEqual(new Set(['CO', 'VE', 'PE']));
  });

  it('never picks an ineligible item, in any mode', () => {
    const allowed = ['CO', 'VE', 'PE', 'US'];
    for (const mode of ['random', 'hard', 'local'] as const) {
      const d = pickDistractors({
        target: fixtureItem('EC'),
        items: ITEMS,
        count: 5,
        mode,
        confusions: [{ asked: 'EC', answered: 'IN', count: 3 }],
        rng: seededRng(2),
        eligible: (k) => allowed.includes(k),
      });
      expect(d.length).toBe(4);
      expect(d.every((k) => allowed.includes(k))).toBe(true);
    }
  });
});

describe('pickDistractors for sequence courses', () => {
  const items = TEST_SEQ_COURSE.items;
  const item = (k: string) => items.find((i) => i.key === k)!;
  const exclusions = TEST_SEQ_COURSE.orderExclusions!;
  const pick = (target: string, extra: Partial<Parameters<typeof pickDistractors>[0]> = {}) =>
    pickDistractors({ target: item(target), items, count: 3, mode: 'sequence', confusions: [], rng: seededRng(1), exclusions, ...extra });

  it('picks the nearest by number, lower number first on ties', () => {
    // s6 sits at 7: s5 (6) and s7 (8) are 1 away; s3 (at 5) beats s8 (at 9) on the tie at 2.
    expect(pick('s6')).toEqual(['s5', 's7', 's3']);
  });

  it('never pairs items that share a span, with the target or with each other', () => {
    expect(pick('s3')).not.toContain('s4');
    expect(pick('s4')).not.toContain('s3');
    for (const target of ['s1', 's2', 's5']) {
      const keys = [target, ...pick(target)];
      expect(keys.includes('s3') && keys.includes('s4')).toBe(false);
    }
  });

  it('respects a window', () => {
    expect(pick('s1', { window: 2, exclusions: [] })).toEqual(['s2', 's3']);
  });

  it('with distinct labels, never repeats a label or offers one the target accepts', () => {
    const label = (i: (typeof items)[number]) => i.answers!.party.text;
    for (const target of items) {
      const taken = [target.answers!.party.text, ...target.answers!.party.aliases];
      const picked = pickDistractors({
        target, items, count: 3, mode: 'sequence', window: 6, confusions: [], rng: seededRng(2), distinct: { label, taken },
      }).map((k) => label(item(k)));
      expect(new Set(picked).size).toBe(picked.length);
      for (const p of picked) expect(taken).not.toContain(p);
    }
    // s8 is party B and also accepts C: neither is ever offered.
    const s8 = pickDistractors({
      target: item('s8'), items, count: 3, mode: 'sequence', window: 6, confusions: [], rng: seededRng(2),
      distinct: { label, taken: ['B', 'C'] },
    });
    expect(s8.map((k) => label(item(k)))).toEqual(['A']);
  });
});
