import { graduate } from './scheduler';
import { untouchedItemsInOrder } from './session';
import type { QueueSession } from './queue';
import type { CourseDef, PromptState } from './types';

export function buildPlacementQueue(course: CourseDef, states: readonly PromptState[]): QueueSession {
  return {
    queue: untouchedItemsInOrder(course, states).map((item) => ({
      kind: 'prompt' as const,
      itemKey: item.key,
      promptType: course.placementPromptType,
    })),
    position: 0,
  };
}

/**
 * A correct placement answer fast-tracks the item's `placementGraduates` prompts (default:
 * all of them) straight into review; the rest stay new and are learned in study.
 */
export function applyPlacementAnswer(args: {
  course: CourseDef;
  states: readonly PromptState[];
  itemKey: string;
  correct: boolean;
  now: Date;
}): PromptState[] {
  const { course, states, itemKey, correct, now } = args;
  if (!correct) return [...states];
  const graduates = new Set(course.placementGraduates ?? course.promptTypes.map((p) => p.id));
  return states.map((s) =>
    s.itemKey === itemKey && s.phase === 'new' && graduates.has(s.promptType) ? graduate(s, now) : s,
  );
}
