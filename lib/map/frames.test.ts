import { describe, expect, it } from 'vitest';
import { GROUP_ORDER } from '@/scripts/content-config';
import { fixtureItem } from '@/lib/engine/test-fixtures';
import { FRAMES, frameFor, GROUP_FRAMES, isFrameId } from './frames';

describe('frames', () => {
  it('has unique ids and maps every learning group to a region and a continent frame', () => {
    expect(new Set(FRAMES.map((f) => f.id)).size).toBe(FRAMES.length);
    for (const g of GROUP_ORDER) {
      expect(isFrameId(GROUP_FRAMES[g].region)).toBe(true);
      expect(isFrameId(GROUP_FRAMES[g].continent)).toBe(true);
    }
  });

  it('uses the continent only for Find at recall', () => {
    const peru = fixtureItem('PE');
    expect(frameFor(peru, 'find', 3)).toBe('continent-south-america');
    expect(frameFor(peru, 'find', 2)).toBe('south-america');
    expect(frameFor(peru, 'capital', 3)).toBe('south-america');
    expect(frameFor(peru, null, 1)).toBe('south-america');
  });

  it('rejects unknown frame ids', () => {
    expect(isFrameId('../secrets')).toBe(false);
  });
});
