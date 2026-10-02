import fs from 'node:fs';
import path from 'node:path';

const FLAG_DIR = path.join(process.cwd(), 'content', 'flags');
const cache = new Map<string, string>();

/**
 * A flag as an `<img src>`-ready data URI. Server-side only (reads the file system).
 * Data URIs keep the country code out of URLs and isolate each SVG's internal ids.
 */
export function flagDataUri(itemKey: string): string {
  const cached = cache.get(itemKey);
  if (cached) return cached;
  const svg = fs.readFileSync(path.join(FLAG_DIR, `${itemKey.toLowerCase()}.svg`), 'utf8');
  const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  cache.set(itemKey, uri);
  return uri;
}
