import { randomUUID } from 'node:crypto';
import { getItem, graduate, initialStates, introduce, seededRng, type CourseDef } from '@/lib/engine';
import { NOW, TEST_COURSE } from '@/lib/engine/test-fixtures';
import { MemoryStore } from '@/lib/db/memory-store';
import type { UserStore } from '@/lib/db/store';
import type { ServiceContext } from './context';
import { flagPresenter } from './present';
import type { AnswerResponse, PendingQuestion } from './types';

export const fakeFlag = (key: string) => `flag#${TEST_COURSE.items.findIndex((i) => i.key === key)}`;

export function testContext(store: UserStore, opts: { now?: Date; seed?: number; course?: CourseDef } = {}): ServiceContext {
  const course = opts.course ?? TEST_COURSE;
  return {
    store,
    course,
    presenter: flagPresenter(course, fakeFlag),
    now: opts.now ?? NOW,
    rng: seededRng(opts.seed ?? 1),
    newId: randomUUID,
  };
}

/** A MemoryStore whose clock can be moved, plus an enrollment for TEST_COURSE. */
export async function enrolledStore(opts: { placementDone?: boolean } = {}) {
  let clock = NOW;
  const store = new MemoryStore(() => clock);
  await store.enroll(TEST_COURSE.slug);
  if (opts.placementDone) await store.setPlacementCompleted(TEST_COURSE.slug, NOW);
  return { store, setClock: (d: Date) => (clock = d) };
}

export function allGraduated(course: CourseDef = TEST_COURSE, at = NOW) {
  return initialStates(course).map((s) => graduate({ ...introduce(s), rung: 3 }, at));
}

/** Reads the server-side pending question (tests only; the browser never sees this). */
export async function pendingFor(store: UserStore, slug = TEST_COURSE.slug): Promise<PendingQuestion> {
  const active = await store.getActiveSession(slug);
  if (!active?.pendingQuestion) throw new Error('No pending question');
  return active.pendingQuestion;
}

export function correctResponse(pending: PendingQuestion, course: CourseDef = TEST_COURSE): AnswerResponse {
  const { entry } = pending;
  if (entry.kind === 'intro') return { kind: 'ack' };
  if (pending.format === 'typed') return { kind: 'typed', text: getItem(course, entry.itemKey).name };
  return { kind: 'choice', choiceId: pending.choices.find((c) => c.itemKey === entry.itemKey)!.id };
}

export function wrongChoice(pending: PendingQuestion): { kind: 'choice'; choiceId: string; itemKey: string } {
  const other = pending.choices.find((c) => c.itemKey !== pending.entry.itemKey)!;
  return { kind: 'choice', choiceId: other.id, itemKey: other.itemKey };
}
