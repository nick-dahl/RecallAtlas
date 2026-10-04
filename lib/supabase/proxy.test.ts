import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getClaims = vi.fn();
let capturedCookiesOption: {
  setAll: (cookies: { name: string; value: string; options?: Record<string, unknown> }[], headers: Record<string, string>) => void;
};
const createServerClient = vi.fn((_url: string, _key: string, options: { cookies: typeof capturedCookiesOption }) => {
  capturedCookiesOption = options.cookies;
  return { auth: { getClaims } };
});
vi.mock('@supabase/ssr', () => ({ createServerClient }));

vi.mock('@/lib/env', () => ({
  publicEnv: () => ({ supabaseUrl: 'https://example.supabase.co', supabasePublishableKey: 'pk' }),
}));

const { updateSession } = await import('./proxy');

function makeRequest(path: string, search = ''): NextRequest {
  return new NextRequest(`http://localhost:3000${path}${search}`);
}

describe('updateSession', () => {
  beforeEach(() => {
    getClaims.mockReset();
    createServerClient.mockClear();
  });

  it('passes through an unprotected route when signed out', async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });
    const response = await updateSession(makeRequest('/login'));
    expect(response.headers.get('location')).toBeNull();
  });

  it('passes through a protected route when signed in', async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: 'user-1' } } });
    const response = await updateSession(makeRequest('/dashboard'));
    expect(response.headers.get('location')).toBeNull();
  });

  it('redirects to /login, preserving the path and query string in next, when signed out', async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });
    const response = await updateSession(makeRequest('/dashboard', '?tab=overview'));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location') ?? '');
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('next')).toBe('/dashboard?tab=overview');
  });

  it('carries cookies and cache headers set during a session refresh onto the login redirect', async () => {
    getClaims.mockImplementation(async () => {
      capturedCookiesOption.setAll([{ name: 'sb-access-token', value: 'refreshed', options: { path: '/' } }], {
        'cache-control': 'no-store',
      });
      return { data: { claims: null } };
    });
    const response = await updateSession(makeRequest('/dashboard'));
    expect(response.status).toBe(307);
    expect(response.cookies.get('sb-access-token')?.value).toBe('refreshed');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
