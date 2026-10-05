import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminEmail, isAdminEmail } from './admin';

afterEach(() => vi.unstubAllEnvs());

describe('admin email', () => {
  it('matches case- and whitespace-insensitively', () => {
    vi.stubEnv('ADMIN_EMAIL', ' Me@Example.com ');
    expect(adminEmail()).toBe('me@example.com');
    expect(isAdminEmail('ME@example.com ')).toBe(true);
    expect(isAdminEmail('someone@example.com')).toBe(false);
  });

  it('allows nobody when ADMIN_EMAIL is unset or blank', () => {
    vi.stubEnv('ADMIN_EMAIL', '');
    expect(adminEmail()).toBeNull();
    expect(isAdminEmail('')).toBe(false);
    expect(isAdminEmail('me@example.com')).toBe(false);
  });
});
