import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import presidents from '@/content/presidents.json';
import type { PresidentRecord } from './types';
import { portraitDataUri } from './portrait-art';

const records = (presidents as { presidents: PresidentRecord[] }).presidents;

describe('portraits', () => {
  it('has a small portrait file for every president', () => {
    for (const r of records) {
      const file = path.join(process.cwd(), 'content', 'portraits', `${r.key}.webp`);
      expect(fs.existsSync(file), r.key).toBe(true);
      expect(fs.statSync(file).size).toBeLessThan(30 * 1024);
    }
  });

  it('serves portraits as webp data URIs that never contain the name or key', () => {
    for (const r of records) {
      const uri = portraitDataUri(r.key);
      expect(uri.startsWith('data:image/webp;base64,')).toBe(true);
      // No name in the image's own bytes (e.g. EXIF/XMP metadata carried over from Commons).
      const bytes = Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64').toString('latin1');
      for (const part of r.name.split(' ')) if (part.length > 3) expect(bytes).not.toContain(part);
    }
  });

  it('credits a public-domain source for every portrait', () => {
    const sources = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content', 'portraits', 'sources.json'), 'utf8'));
    for (const r of records) expect(sources[r.key]?.license, r.key).toMatch(/^(public domain|pd|cc0)/i);
  });
});
