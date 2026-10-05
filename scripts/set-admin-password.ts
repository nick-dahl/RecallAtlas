import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';

/**
 * One-time (or rotate-anytime) setup for the admin password sign-in.
 * Reads ADMIN_EMAIL and ADMIN_PASSWORD from .env.local, creates the account if needed,
 * and sets its password. ADMIN_PASSWORD is only ever used here; never put it on Vercel.
 */
async function main() {
  loadEnvConfig(process.cwd());
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? '';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!email) throw new Error('Set ADMIN_EMAIL in .env.local');
  if (password.length < 16) throw new Error('Set ADMIN_PASSWORD in .env.local (at least 16 characters)');
  if (!url || !secret) throw new Error('Missing Supabase URL or secret key in .env.local');

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  // Creates the account if it doesn't exist ("already registered" is fine).
  await admin.auth.admin.createUser({ email, email_confirm: true });
  // generateLink returns the user record, which gives us the id without paging through all users.
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !data.user) throw error ?? new Error('Could not look up the admin account');

  const updated = await admin.auth.admin.updateUserById(data.user.id, { password });
  if (updated.error) throw updated.error;
  console.log(`Password set for ${email}. Sign in at /login?method=password`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
