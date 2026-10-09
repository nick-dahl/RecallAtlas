import { describe, expect, it, vi } from 'vitest';

const getUserById = vi.fn();
const updateUserById = vi.fn();
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ auth: { admin: { getUserById, updateUserById } } }),
}));

import { markEmailVerified } from './verify';

describe('markEmailVerified never breaks the link it is called from (review fix)', () => {
  it('swallows and logs a failure instead of throwing', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    getUserById.mockRejectedValue(new Error('missing SUPABASE_SECRET_KEY'));
    await expect(markEmailVerified('u1')).resolves.toBeUndefined();
    getUserById.mockResolvedValue({ data: { user: { app_metadata: { confirm_pending: true } } }, error: null });
    updateUserById.mockResolvedValue({ data: null, error: { status: 500, code: 'unexpected_failure' } });
    await expect(markEmailVerified('u1')).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });
});
