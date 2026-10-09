import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { isEmailConfirmed } from './account';
import { markEmailVerified } from './verify';
import { createAdminClient } from '@/lib/supabase/admin';

describe('markEmailVerified on Supabase', () => {
  it('sets email_verified_at once and keeps the first date', async () => {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.createUser({ email: `verify-${randomUUID()}@example.com`, password: randomUUID(), email_confirm: true });
    const id = data.user!.id;
    try {
      expect(isEmailConfirmed(data.user!)).toBe(false);
      await markEmailVerified(id);
      const first = (await admin.auth.admin.getUserById(id)).data.user!;
      expect(isEmailConfirmed(first)).toBe(true);
      await markEmailVerified(id);
      const again = (await admin.auth.admin.getUserById(id)).data.user!;
      expect(again.app_metadata.email_verified_at).toBe(first.app_metadata.email_verified_at);
    } finally {
      await admin.auth.admin.deleteUser(id);
    }
  });
});
