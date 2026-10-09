import { describe, expect, it } from 'vitest';
import {
  confirmDestination,
  isEmailConfirmed,
  isRateLimited,
  MESSAGES,
  newPasswordError,
  normalizeEmail,
  sendResultMessage,
  signInErrorMessage,
  signUpErrorMessage,
  updatePasswordErrorMessage,
  validateCredentials,
} from './account';

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

describe('isEmailConfirmed (Review Focus 5, review fix: no clock)', () => {
  it('only asks accounts made by password sign-up, until an emailed link is used', () => {
    expect(isEmailConfirmed({})).toBe(true);
    expect(isEmailConfirmed({ app_metadata: { provider: 'email' } })).toBe(true);
    expect(isEmailConfirmed({ app_metadata: { confirm_pending: true } })).toBe(false);
    expect(isEmailConfirmed({ app_metadata: { confirm_pending: true, email_verified_at: '2030-01-01T01:00:00Z' } })).toBe(true);
  });
});

describe('error wording after the review', () => {
  it('says a rate-limited sign-in is a rate limit, not a wrong password', () => {
    expect(signInErrorMessage({ status: 429 })).toBe(MESSAGES.tooMany);
    expect(signInErrorMessage({ status: 400, code: 'invalid_credentials' })).toBe(MESSAGES.signInFailed);
  });
  it('never claims an email was sent when sending failed', () => {
    expect(sendResultMessage(null)).toBe(MESSAGES.sent);
    expect(sendResultMessage({ status: 429 })).toBe(MESSAGES.wait);
    expect(sendResultMessage({ status: 500, code: 'unexpected_failure' })).toBe(MESSAGES.sendFailed);
  });
  it('explains a reused or too-weak new password instead of "try again"', () => {
    expect(updatePasswordErrorMessage({ code: 'same_password' })).toBe(MESSAGES.samePassword);
    expect(updatePasswordErrorMessage({ code: 'weak_password' })).toBe(MESSAGES.weakPassword);
    expect(updatePasswordErrorMessage({ status: 500 })).toBe(MESSAGES.updateFailed);
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

describe('password confirmation', () => {
  it('checks the two entries match before length', () => {
    expect(newPasswordError('abcdefgh', 'abcdefgx')).toBe(MESSAGES.mismatch);
    expect(newPasswordError('short', 'short')).toBe(MESSAGES.shortPassword);
    expect(newPasswordError('abcdefgh', 'abcdefgh')).toBeNull();
  });
});
