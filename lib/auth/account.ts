import { safeNext } from './safe-next';

export const PASSWORD_MIN = 8;

/** Accounts created before this release could only sign in through an emailed link, so their inbox is proven. */
export const ACCOUNTS_CUTOFF = new Date('2026-10-08T20:00:00Z');

/** Every message the auth screens show. Never show Supabase's own error text (it can leak internals). */
export const MESSAGES = {
  invalidEmail: 'Enter a valid email address.',
  shortPassword: `Use at least ${PASSWORD_MIN} characters.`,
  exists: 'That email already has an account.',
  createFailed: "Couldn't create your account. Please try again in a minute.",
  signInFailed: "Couldn't sign in with that email and password.",
  resetSent: "If that email has an account, we've sent a reset link.",
  wait: 'Please wait a minute before resending.',
  mismatch: "Passwords don't match.",
  updateFailed: "Couldn't update your password. Please try again in a minute.",
} as const;

type AuthErr = { code?: string; status?: number; message?: string } | null | undefined;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateCredentials(email: string, password: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return MESSAGES.invalidEmail;
  if (password.length < PASSWORD_MIN) return MESSAGES.shortPassword;
  return null;
}

export function signUpErrorMessage(err: AuthErr): string {
  if (err?.code === 'email_exists' || err?.code === 'user_already_exists' || /already (been )?registered/i.test(err?.message ?? '')) {
    return MESSAGES.exists;
  }
  return MESSAGES.createFailed;
}

export function isRateLimited(err: AuthErr): boolean {
  return err?.status === 429 || /rate_limit/.test(err?.code ?? '');
}

export function isEmailConfirmed(
  user: { created_at: string; app_metadata?: Record<string, unknown> },
  cutoff: Date = ACCOUNTS_CUTOFF,
): boolean {
  if (user.app_metadata?.email_verified_at) return true;
  return new Date(user.created_at) < cutoff;
}

/**
 * Where an emailed link lands after verifying. A password reset always goes to the new-password
 * page. Otherwise it's `next`, or the `next` inside the template's `redirect_to` URL. Both go
 * through safeNext.
 */
export function confirmDestination(params: URLSearchParams): string {
  if (params.get('type') === 'recovery') return '/account/password';
  const direct = params.get('next');
  if (direct) return safeNext(direct);
  const redirectTo = params.get('redirect_to');
  if (redirectTo) {
    try {
      return safeNext(new URL(redirectTo).searchParams.get('next'));
    } catch {
      return safeNext(null);
    }
  }
  return safeNext(null);
}
