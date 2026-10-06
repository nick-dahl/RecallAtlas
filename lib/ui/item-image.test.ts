import { describe, expect, it } from 'vitest';
import { imageKind } from './item-image';

describe('imageKind', () => {
  it('picks the flag stamp or the portrait frame from what the item has', () => {
    expect(imageKind({ flag: 'data:x' })).toBe('flag');
    expect(imageKind({ portrait: 'data:y' })).toBe('portrait');
  });

  it('is null when the item has neither, so no broken image renders', () => {
    expect(imageKind({})).toBeNull();
    expect(imageKind({ flag: '' })).toBeNull();
  });
});
