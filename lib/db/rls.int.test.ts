import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newPromptState } from '@/lib/engine';
import { publicEnv } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { createSupabaseStore } from './supabase-store';

const admin = createAdminClient();
const env = publicEnv();
const SLUG = 'rls-course';

async function makeUser() {
  const email = `rls-${randomUUID()}@example.com`;
  const password = randomUUID();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = createClient(env.supabaseUrl, env.supabasePublishableKey, { auth: { persistSession: false } });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  const store = createSupabaseStore(admin, data.user.id);
  await store.enroll(SLUG);
  const session = await store.createSession({ courseSlug: SLUG, kind: 'study', state: {}, pendingQuestion: null });
  await store.commitTurn(SLUG, {
    sessionId: session.id,
    expectedVersion: 0,
    sessionState: {},
    pendingQuestion: null,
    completed: false,
    promptStates: [newPromptState('EC', 'flag_to_name')],
    confusion: { asked: 'EC', answered: 'CO' },
  });
  return { id: data.user.id, client, sessionId: session.id };
}

describe('row level security', () => {
  let a: { id: string; client: SupabaseClient; sessionId: string };
  let b: { id: string; client: SupabaseClient; sessionId: string };

  beforeAll(async () => {
    a = await makeUser();
    b = await makeUser();
  });
  afterAll(async () => {
    await admin.auth.admin.deleteUser(a.id);
    await admin.auth.admin.deleteUser(b.id);
  });

  it('lets a signed-in user read only their own rows', async () => {
    for (const table of ['enrollments', 'prompt_states', 'sessions', 'confusions']) {
      const { data, error } = await a.client.from(table).select('user_id');
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThan(0);
      expect(data!.every((r) => r.user_id === a.id)).toBe(true);
    }
  });

  it('rejects direct writes from the browser client', async () => {
    const insert = await a.client.from('prompt_states').insert({
      user_id: a.id,
      course_slug: SLUG,
      item_key: 'CO',
      prompt_type: 'flag_to_name',
      phase: 'review',
      rung: 3,
      streak: 0,
    });
    expect(insert.error).not.toBeNull();

    const update = await a.client.from('enrollments').update({ passed_at: new Date().toISOString() }).eq('user_id', a.id).select();
    expect(update.data ?? []).toHaveLength(0);

    const { data: enrollment } = await admin
      .from('enrollments')
      .select('passed_at')
      .eq('user_id', a.id)
      .eq('course_slug', SLUG)
      .single();
    expect(enrollment!.passed_at).toBeNull();
  });

  it('does not let users call commit_turn, even with a well-formed payload targeting their own session', async () => {
    const { data: before } = await admin.from('sessions').select('version').eq('id', a.sessionId).single();
    expect(before!.version).toBe(1);

    const { error } = await a.client.rpc('commit_turn', {
      p: {
        user_id: a.id,
        session_id: a.sessionId,
        course_slug: SLUG,
        expected_version: 1,
        session_state: {},
        pending_question: null,
        completed: false,
        prompt_states: [],
      },
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe('42501');
    expect(error!.message).toMatch(/permission denied/i);

    const { data: after } = await admin.from('sessions').select('version').eq('id', a.sessionId).single();
    expect(after!.version).toBe(1);
  });

  it('shows anonymous clients nothing', async () => {
    const anon = createClient(env.supabaseUrl, env.supabasePublishableKey, { auth: { persistSession: false } });
    const { data, error } = await anon.from('prompt_states').select('user_id');
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });
});
