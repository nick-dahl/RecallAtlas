import type { ActionError } from '@/app/actions/course';
import type { SessionKind } from '@/lib/study/types';

/** Transient server/session hiccups: the session or question the client knew about is gone. */
export const RESUMABLE_ERRORS: ReadonlySet<ActionError> = new Set(['stale_question', 'stale_session', 'no_active_session']);

/**
 * True when the player should resolve `error` itself by calling `begin()` again, rather than
 * show a hard error. Outside an exam, a malformed request (`invalid_response`) is also worth
 * one more try — a fresh `begin()` gets a clean session/question pair. An exam never resumes
 * here: its transient errors are handled by {@link blocksExamRestart} instead, and any other
 * exam error is a hard stop (we'd rather the learner see a message than silently restart a
 * graded attempt).
 */
export function isResumable(kind: SessionKind, error: ActionError): boolean {
  if (kind === 'exam') return false;
  if (RESUMABLE_ERRORS.has(error)) return true;
  return error === 'invalid_response';
}

/**
 * True when, for an exam in progress, `error` means the attempt is gone for good. The player
 * sends the learner back to the course page (it shows the last exam attempt) instead of
 * silently restarting a graded session.
 */
export function blocksExamRestart(kind: SessionKind, error: ActionError): boolean {
  return kind === 'exam' && RESUMABLE_ERRORS.has(error);
}
