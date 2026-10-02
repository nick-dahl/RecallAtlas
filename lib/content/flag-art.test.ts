import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { flagDataUri } from './flag-art';
import { WORLD_FLAGS } from './world-flags';

describe('flagDataUri', () => {
  it('returns an SVG data URI for every World Flags item', () => {
    for (const item of WORLD_FLAGS.items) {
      expect(flagDataUri(item.key)).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    }
  });

  it('never contains identifying markup', () => {
    for (const item of WORLD_FLAGS.items) {
      const svg = decodeURIComponent(flagDataUri(item.key).split(',')[1]);
      expect(svg).not.toContain('flag-icons');
      expect(svg).not.toMatch(new RegExp(`id="${item.key.toLowerCase()}"`, 'i'));
    }
  });

  it('no longer ships flags from public/', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'public', 'flags'))).toBe(false);
  });
});
