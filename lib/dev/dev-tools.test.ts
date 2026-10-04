import { afterEach, describe, expect, it, vi } from 'vitest';
import { devLoginEmail, devToolsEnabled } from './dev-tools';

afterEach(() => vi.unstubAllEnvs());

describe('dev tools gate', () => {
  it('is enabled only in development with DEV_LOGIN_EMAIL set', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('DEV_LOGIN_EMAIL', ' Me@Example.com ');
    expect(devToolsEnabled()).toBe(true);
    expect(devLoginEmail()).toBe('me@example.com');
  });

  it('is disabled in production even with DEV_LOGIN_EMAIL set', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DEV_LOGIN_EMAIL', 'me@example.com');
    expect(devToolsEnabled()).toBe(false);
    expect(devLoginEmail()).toBeNull();
  });

  it('is disabled in development without DEV_LOGIN_EMAIL', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('DEV_LOGIN_EMAIL', '');
    expect(devToolsEnabled()).toBe(false);
  });
});
