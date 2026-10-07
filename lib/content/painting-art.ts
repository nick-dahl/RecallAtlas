import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'content', 'paintings');
const cache = new Map<string, string>();

/** A painting as an `<img src>` data URI (server only). Keeps the key out of URLs, like flags and portraits. */
export function paintingDataUri(key: string, size: 'large' | 'thumb'): string {
  const id = `${key}:${size}`;
  const cached = cache.get(id);
  if (cached) return cached;
  const webp = fs.readFileSync(path.join(DIR, size === 'thumb' ? `${key}-thumb.webp` : `${key}.webp`));
  const uri = `data:image/webp;base64,${webp.toString('base64')}`;
  cache.set(id, uri);
  return uri;
}
