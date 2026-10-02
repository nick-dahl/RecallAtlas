import { ENGINE_CONFIG } from './config';
import { isExamReady } from './exam';
import { isDue, retrievability } from './scheduler';
import type { CourseDef, PromptState } from './types';

export type EnrollmentStatus = 'placement' | 'learning' | 'exam_ready' | 'passed';
export type TileState = 'new' | 'learning-1' | 'learning-2' | 'learning-3' | 'review' | 'strong';

/**
 * Placement is resumable: a learner can stop partway through the sweep and
 * come back to it, so a single correct placement answer (which graduates
 * that item) must not flip status to `learning` on its own. Callers mark
 * `placementCompleted` only when the sweep finishes or the learner skips it.
 */
export function deriveStatus(args: {
  course: CourseDef;
  states: readonly PromptState[];
  placementCompleted: boolean;
  passedAt: Date | null;
}): EnrollmentStatus {
  const { course, states, placementCompleted, passedAt } = args;
  if (passedAt) return 'passed';
  if (isExamReady(course, states)) return 'exam_ready';
  if (!placementCompleted) return 'placement';
  return 'learning';
}

export function readiness(course: CourseDef, states: readonly PromptState[]): { graduated: number; total: number } {
  return {
    graduated: states.filter((s) => s.phase === 'review').length,
    total: course.items.length * course.promptTypes.length,
  };
}

/** Mean predicted recall across all prompts (unlearned prompts count as 0). */
export function retentionHealth(states: readonly PromptState[], now: Date): number {
  if (states.length === 0) return 0;
  return states.reduce((sum, s) => sum + retrievability(s, now), 0) / states.length;
}

/**
 * Only meaningful once the course is `passed`: unlearned prompts count as 0
 * in `retentionHealth`, so a course still being learned would otherwise
 * always read as unhealthy.
 */
export function needsReviewNudge(health: number, status: EnrollmentStatus): boolean {
  return status === 'passed' && health < ENGINE_CONFIG.retentionNudgeBelow;
}

export function dueCount(states: readonly PromptState[], now: Date): number {
  return states.filter((s) => isDue(s, now)).length;
}

/** Collapses an item's prompt states into one mastery-grid tile. */
export function itemTileState(itemStates: readonly PromptState[]): TileState {
  const learning = itemStates.filter((s) => s.phase === 'learning');
  if (learning.length > 0) {
    const lowest = Math.max(1, Math.min(...learning.map((s) => s.rung)));
    return `learning-${lowest}` as TileState;
  }
  if (itemStates.length > 0 && itemStates.every((s) => s.phase === 'review')) {
    const minStability = Math.min(...itemStates.map((s) => s.fsrs?.stability ?? 0));
    return minStability >= ENGINE_CONFIG.strongStabilityDays ? 'strong' : 'review';
  }
  return 'new';
}
