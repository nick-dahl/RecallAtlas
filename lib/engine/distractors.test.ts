import { describe, expect, it } from 'vitest';
import { pickDistractors } from './distractors';
import { seededRng } from './random';
import { fixtureItem, ITEMS } from './test-fixtures';

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
