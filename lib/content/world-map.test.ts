import { describe, expect, it } from 'vitest';
import { getCourse, listCourses } from './registry';
import { capitalNote, WORLD_MAP } from './world-map';

describe('WORLD_MAP', () => {
  it('has 208 items and three prompt types, placing on Find and graduating Find + Name', () => {
    expect(WORLD_MAP.items).toHaveLength(208);
    expect(WORLD_MAP.promptTypes.map((p) => p.id)).toEqual(['find', 'name', 'capital']);
    expect(WORLD_MAP).toMatchObject({ placementPromptType: 'find', placementGraduates: ['find', 'name'] });
    expect(WORLD_MAP.items.map((i) => i.key)).toEqual(expect.arrayContaining(['GL', 'PR', 'GF', 'XK', 'TW']));
  });

  it('uses neighbours, then nearby countries, as look-alikes', () => {
    const bo = WORLD_MAP.items.find((i) => i.key === 'BO')!;
    expect(bo.lookalikes.slice(0, 5).sort()).toEqual(['AR', 'BR', 'CL', 'PE', 'PY']);
    const keys = new Set(WORLD_MAP.items.map((i) => i.key));
    for (const item of WORLD_MAP.items) {
      expect(item.lookalikes).not.toContain(item.key);
      for (const k of item.lookalikes) expect(keys.has(k)).toBe(true);
    }
  });

  it('carries capitals as the capital answer, with notes', () => {
    expect(WORLD_MAP.items.find((i) => i.key === 'BO')!.answers!.capital).toEqual({ text: 'Sucre', aliases: ['La Paz'] });
    expect(capitalNote('BO')).toMatch(/seat of government/);
    expect(capitalNote('FR')).toBeNull();
  });

  it('is registered', () => {
    expect(getCourse('world-map')).toBe(WORLD_MAP);
    expect(listCourses()).toContain(WORLD_MAP);
  });
});
