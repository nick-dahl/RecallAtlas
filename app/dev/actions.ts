'use server';

import { revalidatePath } from 'next/cache';
import { notFound, redirect } from 'next/navigation';
import { getCourse } from '@/lib/content/registry';
import { devToolsEnabled } from '@/lib/dev/dev-tools';
import { graduate, initialStates, introduce } from '@/lib/engine';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUserId } from '@/lib/supabase/server';

async function guard(slug: string) {
  if (!devToolsEnabled()) notFound();
  const course = getCourse(slug);
  if (!course) notFound();
  return { userId: await requireUserId(), course, SLUG: course.slug };
}

function check(label: string, error: { message: string } | null) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

/** DEVELOPMENT ONLY: wipe the signed-in user's progress in a course (back to not enrolled). */
export async function resetProgress(slug: string) {
  const { userId, SLUG } = await guard(slug);
  const admin = createAdminClient();
  // Deleting sessions cascades to answers and exam_attempts.
  for (const table of ['sessions', 'prompt_states', 'confusions', 'enrollments'] as const) {
    const { error } = await admin.from(table).delete().eq('user_id', userId).eq('course_slug', SLUG);
    check(`reset ${table}`, error);
  }
  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

/** DEVELOPMENT ONLY: enroll, finish placement, and graduate every prompt so the final exam unlocks. */
export async function makeExamReady(slug: string) {
  const { userId, course, SLUG } = await guard(slug);
  const admin = createAdminClient();
  const now = new Date();

  const enroll = await admin
    .from('enrollments')
    .upsert({ user_id: userId, course_slug: SLUG }, { onConflict: 'user_id,course_slug', ignoreDuplicates: true });
  check('enroll', enroll.error);
  const placement = await admin
    .from('enrollments')
    .update({ placement_completed_at: now.toISOString() })
    .eq('user_id', userId)
    .eq('course_slug', SLUG)
    .is('placement_completed_at', null);
  check('placement', placement.error);
  const sessions = await admin
    .from('sessions')
    .update({ completed_at: now.toISOString() })
    .eq('user_id', userId)
    .eq('course_slug', SLUG)
    .is('completed_at', null);
  check('close sessions', sessions.error);

  const rows = initialStates(course)
    .map((s) => graduate({ ...introduce(s), rung: 3 }, now))
    .map((s) => ({
      user_id: userId,
      course_slug: SLUG,
      item_key: s.itemKey,
      prompt_type: s.promptType,
      phase: s.phase,
      rung: s.rung,
      streak: s.streak,
      fsrs: s.fsrs,
    }));
  const states = await admin.from('prompt_states').upsert(rows);
  check('graduate', states.error);

  revalidatePath('/', 'layout');
  redirect(`/courses/${SLUG}`);
}
