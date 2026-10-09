import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const verifyOtp = vi.fn();
vi.mock('@/lib/supabase/server', () => ({ createSessionClient: async () => ({ auth: { verifyOtp } }) }));
const markEmailVerified = vi.fn();
vi.mock('@/lib/auth/verify', () => ({ markEmailVerified: (id: string) => markEmailVerified(id) }));

import { GET } from './route';

const call = (q: string) => GET(new NextRequest(`http://localhost:3000/auth/confirm?${q}`));

beforeEach(() => {
  verifyOtp.mockReset();
  markEmailVerified.mockReset();
});

describe('GET /auth/confirm', () => {
  it('verifies the token, records the confirmation and follows next', async () => {
    verifyOtp.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const res = await call('token_hash=abc&type=email&next=%2Fcourses%2Fworld-map');
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc', type: 'email' });
    expect(markEmailVerified).toHaveBeenCalledWith('u1');
    expect(res.headers.get('location')).toBe('http://localhost:3000/courses/world-map');
  });

  it('sends a password reset to the new-password page (Review Focus 4)', async () => {
    verifyOtp.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const res = await call('token_hash=abc&type=recovery&next=%2Fdashboard');
    expect(res.headers.get('location')).toBe('http://localhost:3000/account/password');
  });

  it('turns a used, expired or malformed link into the sign-in page message (Review Focus 2)', async () => {
    verifyOtp.mockResolvedValue({ data: { user: null }, error: { status: 403, code: 'otp_expired' } });
    expect((await call('token_hash=abc&type=email')).headers.get('location')).toBe('http://localhost:3000/login?error=link');
    expect((await call('type=email')).headers.get('location')).toBe('http://localhost:3000/login?error=link');
    expect((await call('token_hash=abc&type=bogus')).headers.get('location')).toBe('http://localhost:3000/login?error=link');
    expect(markEmailVerified).not.toHaveBeenCalled();
  });
});
