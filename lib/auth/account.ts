import { safeNext } from './safe-next';

export const PASSWORD_MIN = 8;

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
  tooMany: 'Too many attempts. Please wait a minute and try again.',
  sent: 'Sent.',
  sendFailed: "Couldn't send the email. Please try again later.",
  samePassword: "Choose a password you haven't used here before.",
  weakPassword: 'Choose a stronger password.',
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

/**
 * Whether the account still needs to confirm its email. Only password sign-ups are asked: they're
 * created with `confirm_pending` (app/signup-actions.ts), and opening any emailed link records
 * `email_verified_at` (lib/auth/verify.ts). Older accounts and email-link accounts proved their
 * inbox to get in, so they're never asked. No clock involved.
 */
export function isEmailConfirmed(user: { app_metadata?: Record<string, unknown> }): boolean {
  if (!user.app_metadata?.confirm_pending) return true;
  return Boolean(user.app_metadata.email_verified_at);
}

export function signInErrorMessage(err: AuthErr): string {
  return isRateLimited(err) ? MESSAGES.tooMany : MESSAGES.signInFailed;
}

/** What to tell someone after an email send: never "Sent." when it wasn't. */
export function sendResultMessage(err: AuthErr): string {
  if (!err) return MESSAGES.sent;
  return isRateLimited(err) ? MESSAGES.wait : MESSAGES.sendFailed;
}

export function updatePasswordErrorMessage(err: AuthErr): string {
  if (err?.code === 'same_password') return MESSAGES.samePassword;
  if (err?.code === 'weak_password') return MESSAGES.weakPassword;
  return MESSAGES.updateFailed;
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

export function newPasswordError(password: string, confirm: string): string | null {
  if (password !== confirm) return MESSAGES.mismatch;
  if (password.length < PASSWORD_MIN) return MESSAGES.shortPassword;
  return null;
}
