import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import countries from '@/content/countries.json';
import type { CountryRecord } from '@/lib/content/types';
import { FRAMES, GROUP_FRAMES } from './frames';
import { hitTest } from './hit-test';
import type { AtlasData, FrameData } from './types';

const records = countries as CountryRecord[];
const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), 'utf8');
const frame = (id: string): FrameData => JSON.parse(read('content', 'maps', `${id}.hit.json`));

/** Guards the committed output of `npm run content:build` (map spec §3 validation). */
describe('committed map frames', () => {
  it.each(FRAMES.map((f) => f.id))('%s: base SVG is small and anonymous', (id) => {
    const svg = read('public', 'maps', `${id}.svg`);
    expect(Buffer.byteLength(svg)).toBeLessThanOrEqual(80 * 1024);
    expect(svg).not.toMatch(/\b(id|class|data-[\w-]+)=|<title|<text|<desc/);
    for (const r of records) expect(svg).not.toContain(r.name);
  });

  it('every item hit-tests back to itself in its region and continent frames', () => {
    const failures: string[] = [];
    for (const r of records) {
      for (const id of Object.values(GROUP_FRAMES[r.group])) {
        const f = frame(id);
        const s = f.countries[r.key];
        if (!s) failures.push(`${r.key} missing from ${id}`);
        else if (hitTest(f, s.label[0] / f.width, s.label[1] / f.height, f.width) !== r.key) {
          failures.push(`${r.key} label misses in ${id}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('only puts course items in hit data and the atlas', () => {
    const keys = new Set(records.map((r) => r.key));
    for (const f of FRAMES) for (const k of Object.keys(frame(f.id).countries)) expect(keys.has(k)).toBe(true);
    const atlas = JSON.parse(read('content', 'maps', 'world-atlas.json')) as AtlasData;
    expect(Object.keys(atlas.countries).sort()).toEqual([...keys].sort());
  });

  it('draws the territories and leaves Western Sahara unclickable', () => {
    const naf = frame('north-west-africa');
    expect(naf.countries.EH).toBeUndefined();
    expect(frame('north-central-america').countries.GL).toBeDefined();
    expect(frame('south-america').countries.GF).toBeDefined();
    // French Guiana is carved out of France: France's outline no longer reaches South America.
    expect(frame('south-america').countries.FR).toBeUndefined();
  });
});
