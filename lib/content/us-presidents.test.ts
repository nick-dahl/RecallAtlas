import { describe, expect, it } from 'vitest';
import { getCourse } from './registry';
import { presidentRecord, US_PRESIDENTS } from './us-presidents';

const item = (key: string) => US_PRESIDENTS.items.find((i) => i.key === key)!;

describe('US_PRESIDENTS', () => {
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

  it('is not registered yet (the dashboard lists every registered course)', () => {
    expect(getCourse('us-presidents')).toBeNull();
  });
});
