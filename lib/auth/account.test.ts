import { describe, expect, it } from 'vitest';
import { confirmDestination, isEmailConfirmed, isRateLimited, MESSAGES, normalizeEmail, signUpErrorMessage, validateCredentials } from './account';

describe('validateCredentials', () => {
  it('accepts a real email and an 8+ character password', () => {
    expect(validateCredentials('a@b.co', '12345678')).toBeNull();
  });
  it('names the problem in plain words', () => {
    expect(validateCredentials('nope', '12345678')).toBe(MESSAGES.invalidEmail);
    expect(validateCredentials('a@b.co', '1234567')).toBe(MESSAGES.shortPassword);
  });
});

describe('normalizeEmail (Review Focus 3)', () => {
  it('trims and lower-cases', () => {
    expect(normalizeEmail('  Me@Example.COM ')).toBe('me@example.com');
  });
});

describe('signUpErrorMessage', () => {
  it('maps an existing account, and hides everything else behind one message', () => {
    expect(signUpErrorMessage({ code: 'email_exists', status: 422 })).toBe(MESSAGES.exists);
    expect(signUpErrorMessage({ status: 422, message: 'A user with this email address has already been registered' })).toBe(MESSAGES.exists);
    expect(signUpErrorMessage({ status: 500, message: 'database exploded at row 7' })).toBe(MESSAGES.createFailed);
  });
});

describe('isRateLimited', () => {
  it('recognises Supabase rate limits', () => {
    expect(isRateLimited({ status: 429 })).toBe(true);
    expect(isRateLimited({ code: 'over_email_send_rate_limit' })).toBe(true);
    expect(isRateLimited({ status: 400 })).toBe(false);
  });
});

describe('isEmailConfirmed (Review Focus 5)', () => {
  const cutoff = new Date('2026-10-08T20:00:00Z');
  it('counts accounts created before the cutoff as confirmed', () => {
    expect(isEmailConfirmed({ created_at: '2026-10-01T00:00:00Z' }, cutoff)).toBe(true);
  });
  it('needs our own mark for accounts created after it', () => {
    expect(isEmailConfirmed({ created_at: '2026-10-09T00:00:00Z' }, cutoff)).toBe(false);
    expect(isEmailConfirmed({ created_at: '2026-10-09T00:00:00Z', app_metadata: { email_verified_at: '2026-10-09T01:00:00Z' } }, cutoff)).toBe(true);
  });
});

describe('confirmDestination (Review Focus 4)', () => {
  const p = (q: string) => new URLSearchParams(q);
  it('sends a password reset to the new-password page, whatever it carries', () => {
    expect(confirmDestination(p('type=recovery&next=%2Fcourses%2Fx'))).toBe('/account/password');
  });
  it('follows next, or the next inside a redirect_to, through safeNext', () => {
    expect(confirmDestination(p('type=email&next=%2Fcourses%2Fworld-map'))).toBe('/courses/world-map');
    expect(confirmDestination(p('type=email&redirect_to=https%3A%2F%2Fsite.example%2Fauth%2Fcallback%3Fnext%3D%252Fdashboard'))).toBe('/dashboard');
    expect(confirmDestination(p('type=email&next=https%3A%2F%2Fevil.example'))).toBe('/dashboard');
    expect(confirmDestination(p(''))).toBe('/dashboard');
  });
});
