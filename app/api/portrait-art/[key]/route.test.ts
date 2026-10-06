import { describe, expect, it } from 'vitest';
import { GET } from './route';

const call = (key: string) => GET(new Request(`http://test/api/portrait-art/${key}`), { params: Promise.resolve({ key }) });

describe('GET /api/portrait-art/[key]', () => {
  it('serves a cached webp portrait for a known president', async () => {
    const res = await call('polk');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect(res.headers.get('cache-control')).toContain('immutable');
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(1000);
  });

  it.each(['nobody', '__proto__', '..%2Fpresidents', '../secrets', 'POLK'])('404s for %s', async (key) => {
    expect((await call(key)).status).toBe(404);
  });
});
