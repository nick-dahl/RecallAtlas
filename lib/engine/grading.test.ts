import { describe, expect, it } from 'vitest';
import { acceptedAnswers, editDistance, gradeChoice, gradeTyped, normalize } from './grading';
import { fixtureItem, ITEMS, TEST_MAP_COURSE, TEST_SEQ_COURSE } from './test-fixtures';

describe('normalize', () => {
  it.each([
    ['Côte d’Ivoire', 'cote divoire'],
    ["Côte d'Ivoire", 'cote divoire'],
    ['Côte d‘Ivoire', 'cote divoire'],
    ['  The   Gambia ', 'gambia'],
    ['St. Lucia', 'saint lucia'],
    ['Guinea-Bissau', 'guinea bissau'],
    ['Bosnia & Herzegovina', 'bosnia and herzegovina'],
    ['São Tomé and Príncipe', 'sao tome and principe'],
  ])('%s → %s', (input, expected) => {
    expect(normalize(input)).toBe(expected);
  });
});

describe('editDistance', () => {
  it('computes edit distance', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('peru', 'peru')).toBe(0);
  });

  it('counts an adjacent transposition as a single edit', () => {
    expect(editDistance('chad', 'cahd')).toBe(1);
  });
});

const grade = (input: string, key: string) => gradeTyped(input, fixtureItem(key), ITEMS);

describe('gradeTyped', () => {
  it('accepts exact names and aliases, case/diacritics-insensitive', () => {
    expect(grade('ecuador', 'EC')).toEqual({ correct: true, typo: false, answeredItemKey: null });
    expect(grade('USA', 'US')).toEqual({ correct: true, typo: false, answeredItemKey: null });
    expect(grade('cote divoire', 'CI')).toEqual({ correct: true, typo: false, answeredItemKey: null });
    expect(grade('St Lucia', 'LC')).toEqual({ correct: true, typo: false, answeredItemKey: null });
    expect(grade('the gambia', 'GM')).toEqual({ correct: true, typo: false, answeredItemKey: null });
  });

  it('accepts small typos and flags them', () => {
    expect(grade('Equador', 'EC')).toEqual({ correct: true, typo: true, answeredItemKey: null });
    expect(grade('Madagaskr', 'MG')).toEqual({ correct: true, typo: true, answeredItemKey: null });
    expect(grade('Nigerria', 'NG')).toEqual({ correct: true, typo: true, answeredItemKey: null });
  });

  it('accepts an adjacent-letter transposition as a typo', () => {
    expect(grade('Cahd', 'TD')).toEqual({ correct: true, typo: true, answeredItemKey: null });
    expect(grade('Inida', 'IN')).toEqual({ correct: true, typo: true, answeredItemKey: null });
  });

  it('rejects typos beyond tolerance', () => {
    expect(grade('Pary', 'PE')).toEqual({ correct: false, typo: false, answeredItemKey: null });
  });

  it('never accepts another item; reports it as the confusion', () => {
    expect(grade('Niger', 'NG')).toEqual({ correct: false, typo: false, answeredItemKey: 'NE' });
    expect(grade('Dominica', 'DO')).toEqual({ correct: false, typo: false, answeredItemKey: 'DM' });
    expect(grade('Romania', 'TD')).toEqual({ correct: false, typo: false, answeredItemKey: 'RO' });
  });

  it('lets another item win a typo tie', () => {
    // "nigera" is 1 edit from both "nigeria" and "niger"
    expect(grade('Nigera', 'NG')).toEqual({ correct: false, typo: false, answeredItemKey: 'NE' });
  });

  it('treats empty or unknown input as wrong with no confusion', () => {
    expect(grade('   ', 'EC')).toEqual({ correct: false, typo: false, answeredItemKey: null });
    expect(grade('xyzzy', 'EC')).toEqual({ correct: false, typo: false, answeredItemKey: null });
  });
});

describe('gradeChoice', () => {
  it('grades multiple-choice picks', () => {
    expect(gradeChoice('EC', 'EC')).toEqual({ correct: true, typo: false, answeredItemKey: null });
    expect(gradeChoice('CO', 'EC')).toEqual({ correct: false, typo: false, answeredItemKey: 'CO' });
    expect(gradeChoice(null, 'EC')).toEqual({ correct: false, typo: false, answeredItemKey: null });
  });
});

describe('gradeTyped with an answer field', () => {
  const items = TEST_MAP_COURSE.items;
  const item = (k: string) => items.find((i) => i.key === k)!;

  it('grades capitals, with aliases and accents', () => {
    expect(gradeTyped('Bogota', item('CO'), items, 'capital')).toMatchObject({ correct: true, typo: false });
    expect(gradeTyped('washington', item('US'), items, 'capital').correct).toBe(true);
    expect(gradeTyped('Washington DC', item('US'), items, 'capital').correct).toBe(true);
    expect(gradeTyped('Colombia', item('CO'), items, 'capital').correct).toBe(false);
  });

  it('tolerates typos and transpositions', () => {
    expect(gradeTyped('Quitp', item('EC'), items, 'capital')).toMatchObject({ correct: true, typo: true });
    expect(gradeTyped('Bucharets', item('RO'), items, 'capital')).toMatchObject({ correct: true, typo: true });
  });

  it("records another item's capital as a confusion", () => {
    expect(gradeTyped('Lima', item('EC'), items, 'capital')).toEqual({ correct: false, typo: false, answeredItemKey: 'PE' });
  });

  it('defaults to names, so flags are unchanged', () => {
    expect(gradeTyped('Ecuador', item('EC'), items).correct).toBe(true);
    expect(gradeTyped('Quito', item('EC'), items).correct).toBe(false);
  });

  it('never accepts an answer for a field the item lacks', () => {
    expect(gradeTyped('Quito', fixtureItem('EC'), ITEMS, 'capital').correct).toBe(false);
  });
});

describe('gradeTyped for sequence courses', () => {
  const items = TEST_SEQ_COURSE.items;
  const item = (k: string) => items.find((i) => i.key === k)!;

  it('grades exact answers without typo tolerance, accepting every listed value', () => {
    expect(gradeTyped('1820', item('s3'), items, 'year', { exact: true }).correct).toBe(true);
    expect(gradeTyped('1830', item('s3'), items, 'year', { exact: true }).correct).toBe(true);
    // One transposition away: a typo for a name, a different year here.
    expect(gradeTyped('1810', item('s1'), items, 'year', { exact: true })).toEqual({ correct: false, typo: false, answeredItemKey: 's2' });
    expect(gradeTyped('1802', item('s1'), items, 'year', { exact: true })).toEqual({ correct: false, typo: false, answeredItemKey: null });
  });

  it('accepts a shared year for both owners, and records no mix-up when a wrong year is shared', () => {
    expect(gradeTyped('1840', item('s6'), items, 'year', { exact: true }).correct).toBe(true);
    expect(gradeTyped('1840', item('s7'), items, 'year', { exact: true }).correct).toBe(true);
    expect(gradeTyped('1840', item('s1'), items, 'year', { exact: true })).toEqual({ correct: false, typo: false, answeredItemKey: null });
  });

  it('never accepts a bare shared surname, and tells the namesakes apart', () => {
    expect(gradeTyped('Adams', item('s2'), items)).toEqual({ correct: false, typo: false, answeredItemKey: null });
    expect(gradeTyped('Adams', item('s1'), items)).toEqual({ correct: false, typo: false, answeredItemKey: null });
    expect(gradeTyped('JQA', item('s2'), items).correct).toBe(true);
    expect(gradeTyped('John Adams', item('s2'), items)).toEqual({ correct: false, typo: false, answeredItemKey: 's1' });
  });

  it('lists accepted answers with the displayed one first', () => {
    expect(acceptedAnswers(item('s3'), 'year')).toEqual(['1820', '1830']);
    expect(acceptedAnswers(item('s2'), 'name')).toEqual(['John Quincy Adams', 'JQA']);
    expect(acceptedAnswers(item('s1'), 'missing')).toEqual([]);
  });
});
