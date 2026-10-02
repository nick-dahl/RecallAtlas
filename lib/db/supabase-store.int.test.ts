import { randomUUID } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { describeStoreContract } from './store-contract';
import { createSupabaseStore } from './supabase-store';

const admin = createAdminClient();

describeStoreContract('SupabaseStore', async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: `it-${randomUUID()}@example.com`,
    password: randomUUID(),
    email_confirm: true,
  });
  if (error) throw error;
  const userId = data.user.id;
  return {
    store: createSupabaseStore(admin, userId),
    cleanup: async () => {
      await admin.auth.admin.deleteUser(userId);
    },
  };
});
