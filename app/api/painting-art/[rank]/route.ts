import fs from 'node:fs/promises';
import path from 'node:path';
import { paintingByRank } from '@/lib/content/great-paintings';

/**
 * Painting images for REFERENCE views only (gallery wall, enlarged view), addressed by fame rank so
 * the URL names nothing. Never used inside a question: questions get data URIs. Cached for a day,
 * not forever, so a corrected image reaches returning visitors.
 */
export async function GET(request: Request, { params }: { params: Promise<{ rank: string }> }) {
  const painting = paintingByRank(Number((await params).rank));
  if (!painting) return new Response('Not found', { status: 404 });
  const thumb = new URL(request.url).searchParams.get('size') === 'thumb';
  const file = path.join(process.cwd(), 'content', 'paintings', `${painting.key}${thumb ? '-thumb' : ''}.webp`);
  return new Response(new Uint8Array(await fs.readFile(file)), {
    headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' },
  });
}
