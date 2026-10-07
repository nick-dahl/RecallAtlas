import { describe, expect, it } from 'vitest';
import countries from '@/content/countries.json';
import { capitalNote } from './capitals';
import { getCourse } from './registry';
import type { CountryRecord } from './types';
import { WORLD_CAPITALS } from './world-capitals';

const territories = new Set((countries as CountryRecord[]).filter((c) => c.territory).map((c) => c.key));

describe('WORLD_CAPITALS', () => {
  it('has the 197 countries (no territories) and both directions', () => {
    expect(WORLD_CAPITALS.items).toHaveLength(197);
    expect(WORLD_CAPITALS.items.some((i) => territories.has(i.key))).toBe(false);
    expect(WORLD_CAPITALS.promptTypes.map((p) => p.id)).toEqual(['country_to_capital', 'capital_to_country']);
  });

  it('places on country → capital, fast-tracking both directions', () => {
    expect(WORLD_CAPITALS).toMatchObject({ slug: 'world-capitals', title: 'World Capitals', placementPromptType: 'country_to_capital' });
    expect(WORLD_CAPITALS.placementGraduates).toBeUndefined();
  });

  it('grades country → capital by capital and capital → country by name', () => {
    const [toCapital, toCountry] = WORLD_CAPITALS.promptTypes;
    expect(toCapital.answerField).toBe('capital');
    expect(toCountry.answerField).toBeUndefined();
    expect(WORLD_CAPITALS.items.find((i) => i.key === 'BO')!.answers!.capital).toEqual({ text: 'Sucre', aliases: ['La Paz'] });
    expect(capitalNote('BO')).toMatch(/seat of government/);
    expect(capitalNote('FR')).toBeNull();
  });

  it('never uses a territory as a look-alike', () => {
    for (const item of WORLD_CAPITALS.items) {
      for (const k of item.lookalikes) expect(territories.has(k)).toBe(false);
    }
  });

  it('is registered', () => {
    expect(getCourse('world-capitals')).toBe(WORLD_CAPITALS);
  });
});
