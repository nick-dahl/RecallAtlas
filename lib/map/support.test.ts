import { describe, expect, it } from 'vitest';
import { WORLD_MAP } from '@/lib/content/world-map';
import { loadFrame } from './load';
import { mapSupport } from './support';

const maps = mapSupport(WORLD_MAP, loadFrame);

describe('mapSupport (real frames)', () => {
  it('asks Find at recall on the continent and everything else on the region', () => {
    expect(maps.frameFor({ kind: 'prompt', itemKey: 'BO', promptType: 'find' }, 3)).toBe('continent-south-america');
    expect(maps.frameFor({ kind: 'prompt', itemKey: 'BO', promptType: 'name' }, 3)).toBe('south-america');
    expect(maps.frameFor({ kind: 'intro', itemKey: 'GL' }, 1)).toBe('north-central-america');
  });

  it('puts a contrast drill on a frame that shows both countries', () => {
    expect(maps.frameFor({ kind: 'contrast', itemKey: 'BO', otherKey: 'PE' }, 1)).toBe('south-america');
    // Germany is in another learning group, but drawn on France's region map.
    expect(maps.frameFor({ kind: 'contrast', itemKey: 'AT', otherKey: 'DE' }, 1)).toBe('central-eastern-europe');
    const fr = maps.frameFor({ kind: 'contrast', itemKey: 'FR', otherKey: 'ES' }, 1)!;
    expect(loadFrame(fr).countries.ES).toBeDefined();
  });

  it('drops the map when no frame shows both countries', () => {
    expect(maps.frameFor({ kind: 'contrast', itemKey: 'PT', otherKey: 'NZ' }, 1)).toBeUndefined();
  });
});

describe('mapSupport with mapless entries', () => {
  it('gives no frame to mapless entries and the region frame to the rest', async () => {
    const { WORLD_CAPITALS } = await import('@/lib/content/world-capitals');
    const capitals = mapSupport(WORLD_CAPITALS, loadFrame, {
      mapless: (entry) => entry.kind === 'prompt' && entry.promptType === 'capital_to_country',
    });
    expect(capitals.frameFor({ kind: 'prompt', itemKey: 'PE', promptType: 'capital_to_country' }, 3)).toBeUndefined();
    expect(capitals.frameFor({ kind: 'prompt', itemKey: 'PE', promptType: 'country_to_capital' }, 3)).toBe('south-america');
    expect(capitals.frameFor({ kind: 'intro', itemKey: 'PE' }, 1)).toBe('south-america');
  });
});
