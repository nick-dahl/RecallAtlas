import { randomUUID } from 'node:crypto';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { WORLD_FLAGS } from '@/lib/content/world-flags';
import { graduate, initialStates, introduce } from '@/lib/engine';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

export const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

export async function createTestUser(): Promise<TestUser> {
  const email = `e2e-${randomUUID()}@example.com`;
  const password = randomUUID();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  return { id: data.user.id, email, password };
}

/** Real @supabase/ssr auth cookies for the user, ready for context.addCookies. */
export async function sessionCookies(user: TestUser) {
  const jar = new Map<string, string>();
  const client = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => {
        for (const c of list) jar.set(c.name, c.value);
      },
    },
  });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  return [...jar].map(([name, value]) => ({ name, value, domain: 'localhost', path: '/', sameSite: 'Lax' as const }));
}

export interface PendingRow {
  questionId: string;
  format: string;
  entry: { kind: 'intro' | 'prompt' | 'contrast'; itemKey: string };
  choices: { id: string; itemKey: string }[];
}

export async function pendingQuestion(userId: string): Promise<PendingRow | null> {
  const { data, error } = await admin
    .from('sessions')
    .select('pending_question')
    .eq('user_id', userId)
    .is('completed_at', null)
    .maybeSingle();
  if (error) throw error;
  return (data?.pending_question as PendingRow | null) ?? null;
}

export const nameOf = (key: string) => WORLD_FLAGS.items.find((i) => i.key === key)!.name;

/** Shortcut to exam readiness: every World Flags prompt graduated, placement done. */
export async function graduateEverything(userId: string) {
  const now = new Date();
  const rows = initialStates(WORLD_FLAGS)
    .map((s) => graduate({ ...introduce(s), rung: 3 }, now))
    .map((s) => ({
      user_id: userId,
      course_slug: WORLD_FLAGS.slug,
      item_key: s.itemKey,
      prompt_type: s.promptType,
      phase: s.phase,
      rung: s.rung,
      streak: s.streak,
      fsrs: s.fsrs,
    }));
  const { error } = await admin.from('prompt_states').upsert(rows);
  if (error) throw error;
  await admin
    .from('enrollments')
    .update({ placement_completed_at: now.toISOString() })
    .eq('user_id', userId)
    .eq('course_slug', WORLD_FLAGS.slug);
}
