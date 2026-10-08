import { describe, expect, it } from 'vitest';
import { gradeTyped } from '@/lib/engine/grading';
import { getCourse } from './registry';
import { presidentRecord, US_PRESIDENTS } from './us-presidents';

const item = (key: string) => US_PRESIDENTS.items.find((i) => i.key === key)!;

describe('US_PRESIDENTS', () => {
  it('keeps the full ladder (fill the gap first) only for Sequence', () => {
    expect(US_PRESIDENTS.promptTypes.filter((p) => p.fullLadder).map((p) => p.id)).toEqual(['sequence']);
  });

  it('has 45 items, six prompt types, and places on Number → Name graduating Number → Name and Sequence', () => {
    expect(US_PRESIDENTS.items).toHaveLength(45);
    expect(US_PRESIDENTS.promptTypes.map((p) => p.id)).toEqual([
      'number_to_name',
      'portrait_to_name',
      'name_to_portrait',
      'start_year',
      'party',
      'sequence',
    ]);
    expect(US_PRESIDENTS).toMatchObject({
      slug: 'us-presidents',
      title: 'US Presidents',
      placementPromptType: 'number_to_name',
      placementGraduates: ['number_to_name', 'sequence'],
      orderExclusions: [
        ['cleveland', 'b-harrison'],
        ['trump', 'biden'],
      ],
    });
  });

  it('carries numbers, start years and parties as the engine needs them', () => {
    expect(item('cleveland')).toMatchObject({
      sequence: [22, 24],
      answers: { startYear: { text: '1885', aliases: ['1893'] }, party: { text: 'Democratic', aliases: [] } },
    });
    expect(item('a-johnson').answers!.party).toEqual({ text: 'National Union', aliases: ['Democratic'] });
    expect(item('washington')).toMatchObject({ group: 'Founding era', groupOrder: 1, itemOrder: 1 });
  });

  it('exposes the full record for presenters', () => {
    expect(presidentRecord('polk')).toMatchObject({ name: 'James K. Polk', numbers: [11], startYears: [1845] });
  });

  it('is registered, so the dashboard lists it', () => {
    expect(getCourse('us-presidents')).toBe(US_PRESIDENTS);
  });
});

describe('typed names for namesakes (real course)', () => {
  const grade = (text: string, key: string) =>
    gradeTyped(text, item(key), US_PRESIDENTS.items, 'name', { ambiguous: US_PRESIDENTS.ambiguousAnswers });

  // Each common form → the president it names. Every form is graded against both namesakes:
  // right for its owner, wrong (with a mix-up to the owner) for the other.
  it.each([
    ['John Q. Adams', 'jq-adams', 'j-adams'],
    ['J. Q. Adams', 'jq-adams', 'j-adams'],
    ['John Adams', 'j-adams', 'jq-adams'],
    ['W. Bush', 'gw-bush', 'hw-bush'],
    ['George W. Bush', 'gw-bush', 'hw-bush'],
    ['H. W. Bush', 'hw-bush', 'gw-bush'],
    ['HW Bush', 'hw-bush', 'gw-bush'],
    ['T. Roosevelt', 't-roosevelt', 'f-roosevelt'],
    ['F. D. Roosevelt', 'f-roosevelt', 't-roosevelt'],
    ['L. B. Johnson', 'l-johnson', 'a-johnson'],
    ['A. Johnson', 'a-johnson', 'l-johnson'],
    // An initial without its dot is not an article (review fix: "A Johnson" must stay Andrew).
    ['A Johnson', 'a-johnson', 'l-johnson'],
    ['B. Harrison', 'b-harrison', 'wh-harrison'],
    ['W. H. Harrison', 'wh-harrison', 'b-harrison'],
  ])('"%s" names %s, not %s', (text, owner, other) => {
    expect(grade(text, owner).correct).toBe(true);
    expect(grade(text, other)).toEqual({ correct: false, typo: false, answeredItemKey: owner });
  });

  it.each([
    ['Adams', 'j-adams', 'jq-adams'],
    ['J. Adams', 'j-adams', 'jq-adams'],
    ['Bush', 'hw-bush', 'gw-bush'],
    ['George Bush', 'hw-bush', 'gw-bush'],
    ['Harrison', 'wh-harrison', 'b-harrison'],
    ['Johnson', 'a-johnson', 'l-johnson'],
    ['Roosevelt', 't-roosevelt', 'f-roosevelt'],
  ])('"%s" is ambiguous: wrong for both %s and %s, with no mix-up', (text, a, b) => {
    for (const key of [a, b]) expect(grade(text, key)).toEqual({ correct: false, typo: false, answeredItemKey: null });
  });

  it('accepts full given names', () => {
    expect(grade('Joseph Biden', 'biden').correct).toBe(true);
  });
});
