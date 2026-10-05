import fs from 'node:fs';
import path from 'node:path';

const PORTRAIT_DIR = path.join(process.cwd(), 'content', 'portraits');
const cache = new Map<string, string>();

/**
 * A president's portrait as an `<img src>`-ready data URI. Server-side only (reads the file
 * system). Data URIs keep the president's key out of URLs, like flags.
 */
export function portraitDataUri(key: string): string {
  const cached = cache.get(key);
  if (cached) return cached;
  const webp = fs.readFileSync(path.join(PORTRAIT_DIR, `${key}.webp`));
  const uri = `data:image/webp;base64,${webp.toString('base64')}`;
  cache.set(key, uri);
  return uri;
}
