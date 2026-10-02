import { randomUUID } from 'node:crypto';
import type { Confusion, PromptState } from '@/lib/engine';
import { stateKey } from '@/lib/engine';
import type { SessionKind, PendingQuestion } from '@/lib/study/types';
import {
  SessionConflictError,
  StaleSessionError,
  type AnswerLog,
  type EnrollmentRecord,
  type ExamAttemptRecord,
  type SessionRecord,
  type TurnCommit,
  type UserStore,
} from './store';

interface StoredSession extends SessionRecord {
  completedAt: Date | null;
}

const clone = <T>(value: T): T => structuredClone(value);

/** Drops the internal completedAt flag before handing a session back as a SessionRecord. */
function toRecord(session: StoredSession): SessionRecord {
  return {
    id: session.id,
    courseSlug: session.courseSlug,
    kind: session.kind,
    state: session.state,
    pendingQuestion: session.pendingQuestion,
    version: session.version,
    startedAt: session.startedAt,
    updatedAt: session.updatedAt,
  };
}

/** In-memory UserStore for unit tests. Mirrors SupabaseStore semantics (see store-contract.ts). */
export class MemoryStore implements UserStore {
  readonly answers: (AnswerLog & { courseSlug: string })[] = [];
  private readonly enrollments = new Map<string, EnrollmentRecord>();
  private readonly states = new Map<string, Map<string, PromptState>>();
  private readonly confusions = new Map<string, Map<string, Confusion>>();
  private readonly sessions: StoredSession[] = [];
  private readonly attempts = new Map<string, ExamAttemptRecord[]>();

  constructor(private readonly clock: () => Date = () => new Date()) {}

  async getEnrollment(courseSlug: string) {
    const e = this.enrollments.get(courseSlug);
    return e ? clone(e) : null;
  }

  async enroll(courseSlug: string) {
    if (!this.enrollments.has(courseSlug)) {
      this.enrollments.set(courseSlug, { courseSlug, placementCompletedAt: null, passedAt: null, createdAt: this.clock() });
    }
    return clone(this.enrollments.get(courseSlug)!);
  }

  async setPlacementCompleted(courseSlug: string, at: Date) {
    const e = this.enrollments.get(courseSlug);
    if (e && !e.placementCompletedAt) e.placementCompletedAt = at;
  }

  async getPromptStates(courseSlug: string) {
    return clone([...(this.states.get(courseSlug)?.values() ?? [])]);
  }

  async getConfusions(courseSlug: string) {
    return clone(
      [...(this.confusions.get(courseSlug)?.values() ?? [])].sort(
        (a, b) => a.asked.localeCompare(b.asked) || a.answered.localeCompare(b.answered),
      ),
    );
  }

  async getActiveSession(courseSlug: string) {
    const s = this.sessions.find((x) => x.courseSlug === courseSlug && x.completedAt === null);
    return s ? clone(toRecord(s)) : null;
  }

  async createSession(args: { courseSlug: string; kind: SessionKind; state: unknown; pendingQuestion: PendingQuestion | null }) {
    if (await this.getActiveSession(args.courseSlug)) throw new SessionConflictError();
    const now = this.clock();
    const session: StoredSession = {
      id: randomUUID(),
      courseSlug: args.courseSlug,
      kind: args.kind,
      state: clone(args.state),
      pendingQuestion: clone(args.pendingQuestion),
      version: 0,
      startedAt: now,
      updatedAt: now,
      completedAt: null,
    };
    this.sessions.push(session);
    return clone(toRecord(session));
  }

  async completeSession(sessionId: string) {
    const s = this.sessions.find((x) => x.id === sessionId);
    if (s && !s.completedAt) s.completedAt = this.clock();
  }

  async commitTurn(courseSlug: string, commit: TurnCommit) {
    const s = this.sessions.find((x) => x.id === commit.sessionId);
    if (!s || s.courseSlug !== courseSlug || s.completedAt || s.version !== commit.expectedVersion) {
      throw new StaleSessionError();
    }
    const now = this.clock();
    s.state = clone(commit.sessionState);
    s.pendingQuestion = clone(commit.pendingQuestion);
    s.version += 1;
    s.updatedAt = now;
    if (commit.completed) s.completedAt = now;

    if (!this.states.has(courseSlug)) this.states.set(courseSlug, new Map());
    for (const st of commit.promptStates) this.states.get(courseSlug)!.set(stateKey(st.itemKey, st.promptType), clone(st));

    if (commit.answer) this.answers.push({ ...clone(commit.answer), courseSlug });

    if (commit.confusion) {
      if (!this.confusions.has(courseSlug)) this.confusions.set(courseSlug, new Map());
      const map = this.confusions.get(courseSlug)!;
      const key = `${commit.confusion.asked}>${commit.confusion.answered}`;
      const existing = map.get(key);
      map.set(key, { ...commit.confusion, count: (existing?.count ?? 0) + 1 });
    }

    const e = this.enrollments.get(courseSlug);
    if (e && commit.enrollment) {
      e.placementCompletedAt ??= commit.enrollment.placementCompletedAt ?? null;
      e.passedAt ??= commit.enrollment.passedAt ?? null;
    }

    if (commit.examAttempt) {
      const list = this.attempts.get(courseSlug) ?? [];
      list.push({ ...clone(commit.examAttempt), sessionId: s.id, finishedAt: now });
      this.attempts.set(courseSlug, list);
    }
  }

  async getExamAttempts(courseSlug: string) {
    return clone(this.attempts.get(courseSlug) ?? []);
  }

  // ---- Test seeding helpers (not part of UserStore) ----

  seedPromptStates(courseSlug: string, states: PromptState[]) {
    if (!this.states.has(courseSlug)) this.states.set(courseSlug, new Map());
    for (const st of states) this.states.get(courseSlug)!.set(stateKey(st.itemKey, st.promptType), clone(st));
  }

  seedConfusion(courseSlug: string, asked: string, answered: string, count: number) {
    if (!this.confusions.has(courseSlug)) this.confusions.set(courseSlug, new Map());
    this.confusions.get(courseSlug)!.set(`${asked}>${answered}`, { asked, answered, count });
  }

  /** Simulate time passing for an active session (e.g. staleness tests). */
  backdateActiveSession(courseSlug: string, updatedAt: Date) {
    const s = this.sessions.find((x) => x.courseSlug === courseSlug && x.completedAt === null);
    if (s) s.updatedAt = updatedAt;
  }
}
