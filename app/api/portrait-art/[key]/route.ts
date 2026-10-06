import fs from 'node:fs/promises';
import path from 'node:path';
import { US_PRESIDENTS } from '@/lib/content/us-presidents';

const KEYS = new Set(US_PRESIDENTS.items.map((i) => i.key));

/**
 * Public portraits for REFERENCE views only (course home timeline). Never use this inside a
 * question: the URL names the president. Questions get data URIs.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!KEYS.has(key)) return new Response('Not found', { status: 404 });
  const webp = await fs.readFile(path.join(process.cwd(), 'content', 'portraits', `${key}.webp`));
  return new Response(new Uint8Array(webp), {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
