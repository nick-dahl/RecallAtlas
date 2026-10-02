import { reviewGradeFor } from './answer';
import type { QueueSession } from './queue';
import { shuffle } from './random';
import { applyReview } from './scheduler';
import { indexStates, stateKey } from './state';
import type { AnswerGrade, CourseDef, PromptState, Rng } from './types';

export function isExamReady(course: CourseDef, states: readonly PromptState[]): boolean {
  const idx = indexStates(states);
  return course.items.every((item) =>
    course.promptTypes.every((pt) => idx.get(stateKey(item.key, pt.id))?.phase === 'review'),
  );
}

/** Every item once, random prompt direction, shuffled. Always asked at Recall (rung 3). */
export function buildExamQueue(course: CourseDef, rng: Rng): QueueSession {
  const entries = course.items.map((item) => ({
    kind: 'prompt' as const,
    itemKey: item.key,
    promptType: course.promptTypes[Math.floor(rng() * course.promptTypes.length)].id,
  }));
  return { queue: shuffle(entries, rng), position: 0 };
}

/** Exam answers count as FSRS reviews; a miss lapses the prompt back into learning. */
export function applyExamAnswer(state: PromptState, grade: AnswerGrade, now: Date): PromptState {
  if (state.phase !== 'review') return state;
  return applyReview(state, reviewGradeFor(grade), now);
}

export function scoreExam(
  results: readonly { itemKey: string; correct: boolean }[],
  total: number,
): { score: number; total: number; passed: boolean; missed: string[] } {
  const score = results.filter((r) => r.correct).length;
  return {
    score,
    total,
    passed: results.length === total && score === total,
    missed: results.filter((r) => !r.correct).map((r) => r.itemKey),
  };
}
