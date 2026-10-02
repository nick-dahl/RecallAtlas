import { graduate } from './scheduler';
import { newItemsInOrder } from './session';
import type { QueueSession } from './queue';
import type { CourseDef, PromptState } from './types';

export function buildPlacementQueue(course: CourseDef, states: readonly PromptState[]): QueueSession {
  return {
    queue: newItemsInOrder(course, states).map((item) => ({
      kind: 'prompt' as const,
      itemKey: item.key,
      promptType: course.placementPromptType,
    })),
    position: 0,
  };
}

/** A correct placement answer fast-tracks every prompt of the item straight into review. */
export function applyPlacementAnswer(args: {
  states: readonly PromptState[];
  itemKey: string;
  correct: boolean;
  now: Date;
}): PromptState[] {
  const { states, itemKey, correct, now } = args;
  if (!correct) return [...states];
  return states.map((s) => (s.itemKey === itemKey && s.phase === 'new' ? graduate(s, now) : s));
}
