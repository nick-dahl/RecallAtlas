import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import type { AtlasData } from './types';

let cached: AtlasData | null = null;

/** The course-home reference map (content/maps/world-atlas.json). Server-only, cached. */
export function loadAtlas(): AtlasData {
  cached ??= JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content', 'maps', 'world-atlas.json'), 'utf8')) as AtlasData;
  return cached;
}
