import 'server-only';

/**
 * Development-only conveniences (instant sign-in, progress reset, exam fast-forward).
 * Enabled only under `next dev` AND when DEV_LOGIN_EMAIL is set in .env.local.
 * `process.env.NODE_ENV` is inlined as "production" in production builds, so these are dead code there.
 */
export function devToolsEnabled(): boolean {
  return process.env.NODE_ENV === 'development' && Boolean(process.env.DEV_LOGIN_EMAIL);
}

export function devLoginEmail(): string | null {
  return devToolsEnabled() ? process.env.DEV_LOGIN_EMAIL!.trim().toLowerCase() : null;
}
