import type { SupabaseClient } from '@supabase/supabase-js';
import type { Confusion, PromptState } from '@/lib/engine';
import { stateKey } from '@/lib/engine';
import type { PendingQuestion, SessionKind } from '@/lib/study/types';
import { rowToPromptState, type PromptStateRow } from './serialize';
import {
  SessionConflictError,
  StaleSessionError,
  type EnrollmentRecord,
  type ExamAttemptRecord,
  type SessionRecord,
  type TurnCommit,
  type UserStore,
} from './store';

interface EnrollmentRow {
  course_slug: string;
  placement_completed_at: string | null;
  passed_at: string | null;
  created_at: string;
}

interface SessionRow {
  id: string;
  course_slug: string;
  kind: SessionKind;
  state: unknown;
  pending_question: PendingQuestion | null;
  version: number;
  started_at: string;
  updated_at: string;
}

const toDate = (v: string | null) => (v ? new Date(v) : null);

function toEnrollment(row: EnrollmentRow): EnrollmentRecord {
  return {
    courseSlug: row.course_slug,
    placementCompletedAt: toDate(row.placement_completed_at),
    passedAt: toDate(row.passed_at),
    createdAt: new Date(row.created_at),
  };
}

function toSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    courseSlug: row.course_slug,
    kind: row.kind,
    state: row.state,
    pendingQuestion: row.pending_question,
    version: row.version,
    startedAt: new Date(row.started_at),
    updatedAt: new Date(row.updated_at),
  };
}

function fail(context: string, error: { message: string }): never {
  throw new Error(`${context}: ${error.message}`);
}

/**
 * A single `commit_turn` call upserts every prompt state via one INSERT ... ON
 * CONFLICT DO UPDATE statement, and Postgres rejects a statement that would
 * affect the same conflict target twice ("ON CONFLICT DO UPDATE command cannot
 * affect row a second time"). Collapse duplicates here, keeping the last
 * occurrence, to match MemoryStore (a Map keyed by item x prompt type).
 */
function dedupePromptStates(states: PromptState[]): PromptState[] {
  const byKey = new Map<string, PromptState>();
  for (const s of states) byKey.set(stateKey(s.itemKey, s.promptType), s);
  return [...byKey.values()];
}

/** Postgres-backed UserStore. `admin` must be a secret-key client; every query is scoped to `userId`. */
export function createSupabaseStore(admin: SupabaseClient, userId: string): UserStore {
  const SESSION_COLUMNS = 'id, course_slug, kind, state, pending_question, version, started_at, updated_at';

  async function getEnrollment(courseSlug: string): Promise<EnrollmentRecord | null> {
    const { data, error } = await admin
      .from('enrollments')
      .select('course_slug, placement_completed_at, passed_at, created_at')
      .eq('user_id', userId)
      .eq('course_slug', courseSlug)
      .maybeSingle<EnrollmentRow>();
    if (error) fail('getEnrollment', error);
    return data ? toEnrollment(data) : null;
  }

  return {
    getEnrollment,

    async enroll(courseSlug) {
      const { error } = await admin
        .from('enrollments')
        .upsert({ user_id: userId, course_slug: courseSlug }, { onConflict: 'user_id,course_slug', ignoreDuplicates: true });
      if (error) fail('enroll', error);
      return (await getEnrollment(courseSlug))!;
    },

    async setPlacementCompleted(courseSlug, at) {
      const { error } = await admin
        .from('enrollments')
        .update({ placement_completed_at: at.toISOString() })
        .eq('user_id', userId)
        .eq('course_slug', courseSlug)
        .is('placement_completed_at', null);
      if (error) fail('setPlacementCompleted', error);
    },

    async getPromptStates(courseSlug): Promise<PromptState[]> {
      const { data, error } = await admin
        .from('prompt_states')
        .select('item_key, prompt_type, phase, rung, streak, fsrs')
        .eq('user_id', userId)
        .eq('course_slug', courseSlug)
        .returns<PromptStateRow[]>();
      if (error) fail('getPromptStates', error);
      return (data ?? []).map(rowToPromptState);
    },

    async getConfusions(courseSlug): Promise<Confusion[]> {
      const { data, error } = await admin
        .from('confusions')
        .select('asked_item_key, answered_item_key, count')
        .eq('user_id', userId)
        .eq('course_slug', courseSlug)
        .order('asked_item_key')
        .order('answered_item_key')
        .returns<{ asked_item_key: string; answered_item_key: string; count: number }[]>();
      if (error) fail('getConfusions', error);
      return (data ?? []).map((r) => ({ asked: r.asked_item_key, answered: r.answered_item_key, count: r.count }));
    },

    async getActiveSession(courseSlug) {
      const { data, error } = await admin
        .from('sessions')
        .select(SESSION_COLUMNS)
        .eq('user_id', userId)
        .eq('course_slug', courseSlug)
        .is('completed_at', null)
        .maybeSingle<SessionRow>();
      if (error) fail('getActiveSession', error);
      return data ? toSession(data) : null;
    },

    async createSession({ courseSlug, kind, state, pendingQuestion }) {
      const { data, error } = await admin
        .from('sessions')
        .insert({ user_id: userId, course_slug: courseSlug, kind, state, pending_question: pendingQuestion })
        .select(SESSION_COLUMNS)
        .single<SessionRow>();
      if (error) {
        if (error.code === '23505') throw new SessionConflictError();
        fail('createSession', error);
      }
      return toSession(data);
    },

    async completeSession(sessionId) {
      const { error } = await admin
        .from('sessions')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', sessionId)
        .eq('user_id', userId)
        .is('completed_at', null);
      if (error) fail('completeSession', error);
    },

    async commitTurn(courseSlug, c: TurnCommit) {
      if (c.sessionState === undefined) {
        throw new Error('commitTurn: sessionState is required (use null, not undefined)');
      }
      const p = {
        user_id: userId,
        session_id: c.sessionId,
        course_slug: courseSlug,
        expected_version: c.expectedVersion,
        session_state: c.sessionState,
        pending_question: c.pendingQuestion,
        completed: c.completed,
        prompt_states: dedupePromptStates(c.promptStates),
        answer: c.answer
          ? {
              question_id: c.answer.questionId,
              context: c.answer.context,
              kind: c.answer.kind,
              item_key: c.answer.itemKey,
              prompt_type: c.answer.promptType,
              format: c.answer.format,
              rung: c.answer.rung,
              given_text: c.answer.givenText,
              given_item_key: c.answer.givenItemKey,
              correct: c.answer.correct,
              response_ms: c.answer.responseMs,
            }
          : null,
        confusion: c.confusion ?? null,
        enrollment: c.enrollment
          ? {
              placement_completed_at: c.enrollment.placementCompletedAt?.toISOString() ?? null,
              passed_at: c.enrollment.passedAt?.toISOString() ?? null,
            }
          : null,
        exam_attempt: c.examAttempt
          ? {
              score: c.examAttempt.score,
              total: c.examAttempt.total,
              passed: c.examAttempt.passed,
              missed_item_keys: c.examAttempt.missedItemKeys,
            }
          : null,
      };
      const { error } = await admin.rpc('commit_turn', { p });
      if (error) {
        // P0001 is plpgsql's default SQLSTATE for a bare `raise exception`;
        // the message substring is the actual discriminator (commit_turn
        // raises no other exception), the code just narrows false positives.
        if (error.code === 'P0001' && error.message.includes('stale_session')) throw new StaleSessionError();
        fail('commitTurn', error);
      }
    },

    async getExamAttempts(courseSlug): Promise<ExamAttemptRecord[]> {
      const { data, error } = await admin
        .from('exam_attempts')
        .select('session_id, score, total, passed, missed_item_keys, finished_at')
        .eq('user_id', userId)
        .eq('course_slug', courseSlug)
        .order('finished_at')
        .returns<
          { session_id: string; score: number; total: number; passed: boolean; missed_item_keys: string[]; finished_at: string }[]
        >();
      if (error) fail('getExamAttempts', error);
      return (data ?? []).map((r) => ({
        sessionId: r.session_id,
        score: r.score,
        total: r.total,
        passed: r.passed,
        missedItemKeys: r.missed_item_keys,
        finishedAt: new Date(r.finished_at),
      }));
    },
  };
}
