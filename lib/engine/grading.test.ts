import { describe, expect, it } from 'vitest';
import { editDistance, gradeChoice, gradeTyped, normalize } from './grading';
import { fixtureItem, ITEMS } from './test-fixtures';

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
