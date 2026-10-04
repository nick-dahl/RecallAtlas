import { afterEach, describe, expect, it, vi } from 'vitest';
import { siteUrl } from './env';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('siteUrl', () => {
  it('returns NEXT_PUBLIC_SITE_URL with any trailing slash stripped, when set', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://recall-atlas.example/');
    expect(siteUrl()).toBe('https://recall-atlas.example');
  });

  it('returns NEXT_PUBLIC_SITE_URL as-is when it has no trailing slash', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://recall-atlas.example');
    expect(siteUrl()).toBe('https://recall-atlas.example');
  });

  it('defaults to localhost outside production when unset', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', undefined);
    vi.stubEnv('NODE_ENV', 'test');
    expect(siteUrl()).toBe('http://localhost:3000');
  });

  it('throws the missing-variable error in production when unset', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', undefined);
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => siteUrl()).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });
});
