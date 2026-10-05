/**
 * The single account allowed to sign in with a password (for experimenting without
 * waiting on magic-link emails). Set ADMIN_EMAIL (server-only) locally and on Vercel;
 * set the password itself with `npm run admin:set-password` (never stored on Vercel).
 */
export function adminEmail(): string | null {
  const value = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return value ? value : null;
}

export function isAdminEmail(email: string): boolean {
  const admin = adminEmail();
  return admin !== null && email.trim().toLowerCase() === admin;
}
