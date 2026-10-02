import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalize } from '@/lib/engine/grading';
import { getCourse } from './registry';
import { flagPath, WORLD_FLAGS } from './world-flags';

describe('WORLD_FLAGS', () => {
  it('has 197 items and two prompt types', () => {
    expect(WORLD_FLAGS.items).toHaveLength(197);
    expect(WORLD_FLAGS.promptTypes.map((p) => p.id)).toEqual(['flag_to_name', 'name_to_flag']);
    expect(WORLD_FLAGS.placementPromptType).toBe('flag_to_name');
  });

  it('has a flag file for every item', () => {
    for (const item of WORLD_FLAGS.items) {
      expect(fs.existsSync(path.join(process.cwd(), 'public', flagPath(item.key)))).toBe(true);
    }
  });

  it('only references existing items as look-alikes', () => {
    const keys = new Set(WORLD_FLAGS.items.map((i) => i.key));
    for (const item of WORLD_FLAGS.items) for (const k of item.lookalikes) expect(keys.has(k)).toBe(true);
  });

  it('has no two items whose names or aliases normalize identically', () => {
    const owner = new Map<string, string>();
    for (const item of WORLD_FLAGS.items) {
      for (const n of new Set([item.name, ...item.aliases].map(normalize))) {
        expect(owner.get(n) ?? item.key).toBe(item.key);
        owner.set(n, item.key);
      }
    }
  });
});

describe('registry', () => {
  it('looks up courses by slug', () => {
    expect(getCourse('world-flags')).toBe(WORLD_FLAGS);
    expect(getCourse('nope')).toBeNull();
  });
});
