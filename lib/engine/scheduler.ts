import { createEmptyCard, fsrs, generatorParameters, Rating } from 'ts-fsrs';
import { ENGINE_CONFIG } from './config';
import type { PromptState } from './types';

const scheduler = fsrs(
  generatorParameters({
    request_retention: ENGINE_CONFIG.desiredRetention,
    enable_short_term: false, // the ladder replaces FSRS learning steps
    enable_fuzz: false, // deterministic; revisit when real users arrive
  }),
);

export type ReviewGrade = 'good' | 'hard' | 'again';

const RATING: Record<ReviewGrade, Rating.Good | Rating.Hard | Rating.Again> = {
  good: Rating.Good,
  hard: Rating.Hard,
  again: Rating.Again,
};

/** Learning → review. Reuses the existing card after a lapse so FSRS history is kept. */
export function graduate(state: PromptState, now: Date): PromptState {
  const card = state.fsrs ?? createEmptyCard(now);
  return {
    ...state,
    phase: 'review',
    rung: 3,
    streak: 0,
    fsrs: scheduler.next(card, now, Rating.Good).card,
  };
}

export function applyReview(state: PromptState, grade: ReviewGrade, now: Date): PromptState {
  if (state.phase !== 'review' || !state.fsrs) {
    throw new Error(`applyReview expects a review prompt, got ${state.phase} (${state.itemKey}:${state.promptType})`);
  }
  const card = scheduler.next(state.fsrs, now, RATING[grade]).card;
  if (grade === 'again') {
    return { ...state, phase: 'learning', rung: ENGINE_CONFIG.lapseRung, streak: 0, fsrs: card };
  }
  return { ...state, fsrs: card };
}

export function isDue(state: PromptState, now: Date): boolean {
  return state.phase === 'review' && state.fsrs !== null && state.fsrs.due.getTime() <= now.getTime();
}

/** Predicted probability of recall now; 0 for prompts not in review. */
export function retrievability(state: PromptState, now: Date): number {
  if (state.phase !== 'review' || !state.fsrs) return 0;
  return scheduler.get_retrievability(state.fsrs, now, false);
}
