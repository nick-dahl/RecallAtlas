import fs from 'node:fs/promises';
import path from 'node:path';
import { WORLD_FLAGS } from '@/lib/content/world-flags';

const KEYS = new Set(WORLD_FLAGS.items.map((i) => i.key));

/**
 * Public flag art for REFERENCE views only (album grid, landing page).
 * Never use this inside a question: the URL names the country. Questions get data URIs.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const key = (await params).key.toUpperCase();
  if (!KEYS.has(key)) return new Response('Not found', { status: 404 });
  const svg = await fs.readFile(path.join(process.cwd(), 'content', 'flags', `${key.toLowerCase()}.svg`), 'utf8');
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}
