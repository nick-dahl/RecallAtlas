import { describe, expect, it } from 'vitest';
import { GET } from './route';

const call = (key: string) => GET(new Request(`http://test/api/flag-art/${key}`), { params: Promise.resolve({ key }) });

describe('GET /api/flag-art/[key]', () => {
  it('serves a cached, scrubbed SVG for a known flag (case-insensitive)', async () => {
    for (const key of ['EC', 'ec']) {
      const res = await call(key);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('image/svg+xml');
      expect(res.headers.get('cache-control')).toContain('immutable');
      const body = await res.text();
      expect(body.startsWith('<svg')).toBe(true);
      expect(body).not.toContain('flag-icons');
    }
  });

  it.each(['ZZ', '__proto__', '..%2Fcountries', 'e c'])('404s for %s', async (key) => {
    expect((await call(key)).status).toBe(404);
  });
});
