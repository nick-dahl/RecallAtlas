import { ENGINE_CONFIG } from './config';
import type { PromptState, Rung } from './types';

export type LadderOutcome = 'climbed' | 'held' | 'dropped' | 'graduate';

export function introduce(state: PromptState): PromptState {
  if (state.phase !== 'new') return state;
  return { ...state, phase: 'learning', rung: 1, streak: 0 };
}

export function applyLearningAnswer(
  state: PromptState,
  correct: boolean,
): { state: PromptState; outcome: LadderOutcome } {
  if (state.phase !== 'learning') {
    throw new Error(`applyLearningAnswer expects a learning prompt, got ${state.phase} (${state.itemKey}:${state.promptType})`);
  }
  const rung = Math.max(1, state.rung) as 1 | 2 | 3;

  if (!correct) {
    return { state: { ...state, rung: Math.max(1, rung - 1) as Rung, streak: 0 }, outcome: 'dropped' };
  }

  const streak = state.streak + 1;
  if (streak < ENGINE_CONFIG.climbStreak[rung]) {
    return { state: { ...state, rung, streak }, outcome: 'held' };
  }
  if (rung === 3) {
    return { state: { ...state, rung, streak: 0 }, outcome: 'graduate' };
  }
  return { state: { ...state, rung: (rung + 1) as Rung, streak: 0 }, outcome: 'climbed' };
}
