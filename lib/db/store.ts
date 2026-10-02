import type { Confusion, PromptState } from '@/lib/engine';
import type { PendingQuestion, SessionKind } from '@/lib/study/types';

export interface EnrollmentRecord {
  courseSlug: string;
  placementCompletedAt: Date | null;
  passedAt: Date | null;
  createdAt: Date;
}

export interface SessionRecord {
  id: string;
  courseSlug: string;
  kind: SessionKind;
  /** Engine session object (StudySession, QueueSession, or ExamState). */
  state: unknown;
  pendingQuestion: PendingQuestion | null;
  version: number;
  startedAt: Date;
  updatedAt: Date;
}

export interface AnswerLog {
  questionId: string;
  context: SessionKind;
  kind: 'prompt' | 'contrast';
  itemKey: string;
  promptType: string | null;
  format: string;
  rung: number | null;
  givenText: string | null;
  givenItemKey: string | null;
  correct: boolean;
  responseMs: number | null;
}

export interface ExamAttemptRecord {
  sessionId: string;
  score: number;
  total: number;
  passed: boolean;
  missedItemKeys: string[];
  finishedAt: Date;
}

export interface TurnCommit {
  sessionId: string;
  expectedVersion: number;
  sessionState: unknown;
  pendingQuestion: PendingQuestion | null;
  completed: boolean;
  /** Only the prompt states that changed this turn. */
  promptStates: PromptState[];
  answer?: AnswerLog;
  /** Increments the pair's count by one. */
  confusion?: { asked: string; answered: string };
  /** Milestones are set once and never overwritten. */
  enrollment?: { placementCompletedAt?: Date; passedAt?: Date };
  examAttempt?: { score: number; total: number; passed: boolean; missedItemKeys: string[] };
}

export class StaleSessionError extends Error {
  constructor() {
    super('stale_session');
    this.name = 'StaleSessionError';
  }
}

export class SessionConflictError extends Error {
  constructor() {
    super('session_conflict');
    this.name = 'SessionConflictError';
  }
}

/** Persistence for one user. Every method is implicitly scoped to that user. */
export interface UserStore {
  getEnrollment(courseSlug: string): Promise<EnrollmentRecord | null>;
  /** Idempotent. */
  enroll(courseSlug: string): Promise<EnrollmentRecord>;
  /** No-op if already set. */
  setPlacementCompleted(courseSlug: string, at: Date): Promise<void>;
  /** Stored (touched) prompt states only, FSRS dates revived. Use hydrateStates for the full set. */
  getPromptStates(courseSlug: string): Promise<PromptState[]>;
  /** Sorted by asked, then answered key. */
  getConfusions(courseSlug: string): Promise<Confusion[]>;
  getActiveSession(courseSlug: string): Promise<SessionRecord | null>;
  /** Throws SessionConflictError if the course already has an active session. */
  createSession(args: {
    courseSlug: string;
    kind: SessionKind;
    state: unknown;
    pendingQuestion: PendingQuestion | null;
  }): Promise<SessionRecord>;
  completeSession(sessionId: string): Promise<void>;
  /** Atomic. Throws StaleSessionError if the session is inactive or its version moved on. */
  commitTurn(courseSlug: string, commit: TurnCommit): Promise<void>;
  getExamAttempts(courseSlug: string): Promise<ExamAttemptRecord[]>;
}
