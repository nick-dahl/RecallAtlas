import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionConflictError, StaleSessionError } from '@/lib/db/store';
import { ServiceError } from '@/lib/study/types';

const getUserId = vi.fn();
vi.mock('@/lib/supabase/server', () => ({ getUserId }));

const createServiceContext = vi.fn();
vi.mock('@/lib/server/context', () => ({ createServiceContext }));

const { enrollAction } = await import('./course');

function ctxWithEnroll(enroll: (slug: string) => Promise<unknown>) {
  return { store: { enroll }, course: { slug: 'world-flags' } } as unknown as ReturnType<typeof createServiceContext>;
}

describe('run (exercised through enrollAction)', () => {
  beforeEach(() => {
    getUserId.mockReset();
    createServiceContext.mockReset();
  });

  it('returns unauthorized when there is no signed-in user', async () => {
    getUserId.mockResolvedValue(null);
    await expect(enrollAction('world-flags')).resolves.toEqual({ ok: false, error: 'unauthorized' });
    expect(createServiceContext).not.toHaveBeenCalled();
  });

  it('returns unknown_course for a slug with no matching course', async () => {
    getUserId.mockResolvedValue('user-1');
    await expect(enrollAction('not-a-real-course')).resolves.toEqual({ ok: false, error: 'unknown_course' });
  });

  it('returns unknown_course for a non-string slug', async () => {
    getUserId.mockResolvedValue('user-1');
    await expect(enrollAction(42 as unknown as string)).resolves.toEqual({ ok: false, error: 'unknown_course' });
  });

  it('maps ServiceError to its code', async () => {
    getUserId.mockResolvedValue('user-1');
    createServiceContext.mockReturnValue(ctxWithEnroll(() => Promise.reject(new ServiceError('not_enrolled'))));
    await expect(enrollAction('world-flags')).resolves.toEqual({ ok: false, error: 'not_enrolled' });
  });

  it('maps StaleSessionError to stale_session', async () => {
    getUserId.mockResolvedValue('user-1');
    createServiceContext.mockReturnValue(ctxWithEnroll(() => Promise.reject(new StaleSessionError())));
    await expect(enrollAction('world-flags')).resolves.toEqual({ ok: false, error: 'stale_session' });
  });

  it('maps SessionConflictError to stale_session', async () => {
    getUserId.mockResolvedValue('user-1');
    createServiceContext.mockReturnValue(ctxWithEnroll(() => Promise.reject(new SessionConflictError())));
    await expect(enrollAction('world-flags')).resolves.toEqual({ ok: false, error: 'stale_session' });
  });

  it('rethrows unrecognized errors', async () => {
    getUserId.mockResolvedValue('user-1');
    createServiceContext.mockReturnValue(ctxWithEnroll(() => Promise.reject(new Error('boom'))));
    await expect(enrollAction('world-flags')).rejects.toThrow('boom');
  });

  it('returns data on success', async () => {
    getUserId.mockResolvedValue('user-1');
    createServiceContext.mockReturnValue(ctxWithEnroll(() => Promise.resolve(undefined)));
    await expect(enrollAction('world-flags')).resolves.toEqual({ ok: true, data: undefined });
  });
});
