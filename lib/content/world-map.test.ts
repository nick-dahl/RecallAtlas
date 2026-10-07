import { describe, expect, it } from 'vitest';
import { graduate, hydrateStates, introduce, newPromptState } from '@/lib/engine';
import { getCourse, listCourses } from './registry';
import { WORLD_MAP } from './world-map';

describe('WORLD_MAP', () => {
  it('has 208 items and only the map prompts, placing on Find and graduating both', () => {
    expect(WORLD_MAP.items).toHaveLength(208);
    expect(WORLD_MAP.promptTypes.map((p) => p.id)).toEqual(['find', 'name']);
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


  it('is registered', () => {
    expect(getCourse('world-map')).toBe(WORLD_MAP);
    expect(listCourses()).toContain(WORLD_MAP);
  });
});

describe('World Map learners with capital progress from before the split', () => {
  it('ignore stored capital rows and keep their Find and Name progress', () => {
    const find = graduate({ ...introduce(newPromptState('PE', 'find')), rung: 3 }, new Date('2026-10-01'));
    const capital = { ...newPromptState('PE', 'capital'), phase: 'learning' as const, rung: 2 as const };
    const states = hydrateStates(WORLD_MAP, [find, capital]);
    expect(states).toHaveLength(2 * 208);
    expect(states.find((s) => s.itemKey === 'PE' && s.promptType === 'find')).toEqual(find);
    expect(states.some((s) => s.promptType === 'capital')).toBe(false);
  });
});
