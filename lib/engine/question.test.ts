import { describe, expect, it } from 'vitest';
import { buildQuestion, rungForState } from './question';
import { seededRng } from './random';
import { newPromptState } from './state';
import { TEST_COURSE, TEST_MAP_COURSE, TEST_SEQ_COURSE } from './test-fixtures';
import type { CourseDef, Item } from './types';

const base = { course: TEST_COURSE, confusions: [], rng: seededRng(11) };

describe('buildQuestion', () => {
  it('builds an intro card', () => {
    expect(buildQuestion({ ...base, entry: { kind: 'intro', itemKey: 'EC' }, rung: 1 })).toEqual({
      entry: { kind: 'intro', itemKey: 'EC' },
      format: 'intro',
    });
  });

  it('builds a contrast drill with both items as choices', () => {
    const q = buildQuestion({ ...base, entry: { kind: 'contrast', itemKey: 'TD', otherKey: 'RO' }, rung: 1 });
    expect(q.format).toBe('contrast');
    expect([...q.choiceKeys!].sort()).toEqual(['RO', 'TD']);
  });

  it('builds a 4-option text MC at rung 1 for flag_to_name', () => {
    const q = buildQuestion({ ...base, entry: { kind: 'prompt', itemKey: 'EC', promptType: 'flag_to_name' }, rung: 1 });
    expect(q.format).toBe('mc-text');
    expect(q.choiceKeys).toHaveLength(4);
    expect(q.choiceKeys).toContain('EC');
  });

  it('builds a typed question at rung 3 for flag_to_name', () => {
    const q = buildQuestion({ ...base, entry: { kind: 'prompt', itemKey: 'EC', promptType: 'flag_to_name' }, rung: 3 });
    expect(q).toEqual({ entry: { kind: 'prompt', itemKey: 'EC', promptType: 'flag_to_name' }, format: 'typed' });
  });

  it('builds an 8-flag grid with look-alikes at rung 3 for name_to_flag', () => {
    const q = buildQuestion({ ...base, entry: { kind: 'prompt', itemKey: 'TD', promptType: 'name_to_flag' }, rung: 3 });
    expect(q.format).toBe('flag-grid');
    expect(q.choiceKeys).toHaveLength(8);
    expect(q.choiceKeys).toEqual(expect.arrayContaining(['TD', 'RO']));
  });

  it('throws for an unknown prompt type', () => {
    expect(() =>
      buildQuestion({ ...base, entry: { kind: 'prompt', itemKey: 'EC', promptType: 'nope' }, rung: 1 }),
    ).toThrow(/nope/);
  });
});

describe('rungForState', () => {
  it('uses recall for reviews and the current rung (min 1) otherwise', () => {
    const s = newPromptState('EC', 'flag_to_name');
    expect(rungForState(s)).toBe(1);
    expect(rungForState({ ...s, phase: 'learning', rung: 2 })).toBe(2);
    expect(rungForState({ ...s, phase: 'review', rung: 3 })).toBe(3);
  });
});

describe('buildQuestion for maps', () => {
  const find = { kind: 'prompt' as const, itemKey: 'EC', promptType: 'find' };

  it('builds map-pick with choices and map-click without', () => {
    const pick = buildQuestion({ entry: find, rung: 1, course: TEST_MAP_COURSE, confusions: [], rng: seededRng(1) });
    expect(pick.format).toBe('map-pick');
    expect(pick.choiceKeys).toHaveLength(4);
    expect(pick.choiceKeys).toContain('EC');
    const click = buildQuestion({ entry: find, rung: 3, course: TEST_MAP_COURSE, confusions: [], rng: seededRng(1) });
    expect(click).toEqual({ entry: find, format: 'map-click' });
  });

  it('passes eligibility through to distractors', () => {
    const q = buildQuestion({
      entry: find,
      rung: 2,
      course: TEST_MAP_COURSE,
      confusions: [{ asked: 'EC', answered: 'IN', count: 4 }],
      rng: seededRng(4),
      eligible: (k) => ['CO', 'VE', 'PE', 'US', 'DO', 'DM'].includes(k),
    });
    expect(q.choiceKeys).toHaveLength(6);
    expect(q.choiceKeys).not.toContain('IN');
  });
});

describe('buildQuestion for sequence courses', () => {
  const course = TEST_SEQ_COURSE;
  const q = (itemKey: string, promptType: string, rung: 1 | 2 | 3, seed = 1) =>
    buildQuestion({ entry: { kind: 'prompt', itemKey, promptType }, rung, course, confusions: [], rng: seededRng(seed) });
  const answer = (key: string, field: string) => course.items.find((i) => i.key === key)!.answers![field].text;

  it('builds put-in-order from the target and its 3 nearest, never pairing s3 with s4', () => {
    for (let seed = 0; seed < 10; seed++) {
      const order = q('s4', 'sequence', 2, seed);
      expect(order.format).toBe('order');
      expect(order.choiceKeys).toHaveLength(4);
      expect(order.choiceKeys).toContain('s4');
      expect(order.choiceKeys).not.toContain('s3');
    }
  });

  it('gives party questions 2–4 options with distinct labels', () => {
    for (const item of course.items) {
      const labels = q(item.key, 'party', 1).choiceKeys!.map((k) => answer(k, 'party'));
      expect(labels.length).toBeGreaterThanOrEqual(2);
      expect(labels.length).toBeLessThanOrEqual(4);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  it('never repeats a year among the options', () => {
    for (let seed = 0; seed < 10; seed++) {
      for (const key of ['s6', 's7']) {
        const years = q(key, 'year', 2, seed).choiceKeys!.map((k) => answer(k, 'year'));
        expect(new Set(years).size).toBe(years.length);
      }
    }
  });

  it('issues the gap formats', () => {
    expect(q('s2', 'sequence', 1).format).toBe('gap-choice');
    expect(q('s2', 'sequence', 3)).toEqual({ entry: { kind: 'prompt', itemKey: 's2', promptType: 'sequence' }, format: 'gap-typed' });
  });
});

describe('shared answers (Anonymous) are balanced', () => {
  const N = 40;
  const ANON = 4;
  const items: Item[] = Array.from({ length: N }, (_, i) => ({
    // Anonymous works sit in a group of their own, as in the real course, so an ordinary draw rarely shows them.
    key: `p${i}`, name: `Painting ${i}`, aliases: [], group: i < ANON ? 'ancient' : `g${i % 3}`, groupOrder: 1, itemOrder: i, lookalikes: [],
    answers: { artist: { text: i < ANON ? 'Anonymous' : `Artist ${i}`, aliases: [] } },
  }));
  const course: CourseDef = {
    slug: 'test-shared', title: 'Shared', placementPromptType: 'artist', items,
    promptTypes: [{ id: 'artist', label: 'Artist', answerField: 'artist', distinctChoices: true, sharedAnswer: 'Anonymous',
      formats: { 1: { format: 'mc-text', choices: 4, distractors: 'local' }, 2: { format: 'mc-text', choices: 6, distractors: 'hard' }, 3: { format: 'typed' } } }],
  };
  const isAnon = (k: string) => Number(k.slice(1)) < ANON;

  it('shows Anonymous on named works often enough that it is right about 1 time in 4', () => {
    let shownOnNamed = 0;
    let named = 0;
    for (let seed = 0; seed < 200; seed++) {
      for (const [i, item] of items.filter((it) => !isAnon(it.key)).entries()) {
        // A seed per question: reusing one seed across items would make them one draw, not 36.
        const q = buildQuestion({ entry: { kind: 'prompt', itemKey: item.key, promptType: 'artist' }, rung: 1, course, confusions: [], rng: seededRng(seed * 1000 + i) });
        const anons = q.choiceKeys!.filter(isAnon).length;
        expect(anons).toBeLessThanOrEqual(1);
        shownOnNamed += anons;
        named++;
      }
    }
    // Expected rate q = (4 - 1) × 4 / 36 = 1/3 per named question, so P(right | shown) = 4 / (4 + 36q) = 1/4.
    expect(shownOnNamed / named).toBeGreaterThan(0.29);
    expect(shownOnNamed / named).toBeLessThan(0.38);
  });

  it('never shows a second Anonymous on an anonymous work', () => {
    for (let seed = 0; seed < 50; seed++) {
      const q = buildQuestion({ entry: { kind: 'prompt', itemKey: 'p0', promptType: 'artist' }, rung: 2, course, confusions: [], rng: seededRng(seed) });
      expect(q.choiceKeys!.filter(isAnon)).toEqual(['p0']);
    }
  });
});
