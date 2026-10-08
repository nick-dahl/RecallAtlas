import { recordConfusion, shouldInjectContrast } from './confusion';
import { applyLearningAnswer, introduce } from './ladder';
import { applyReview, graduate, type ReviewGrade } from './scheduler';
import {
  queueContrast,
  recordContrastServed,
  recordIntroServed,
  recordPromptAnswered,
  type StudySession,
} from './session';
import type { AnswerGrade, Confusion, PromptEntry, PromptState } from './types';

export type StudyOutcome = 'climbed' | 'held' | 'dropped' | 'graduated' | 'reviewed' | 'lapsed';

export function reviewGradeFor(grade: AnswerGrade): ReviewGrade {
  if (!grade.correct) return 'again';
  return grade.typo ? 'hard' : 'good';
}

export function applyStudyAnswer(args: {
  session: StudySession;
  state: PromptState;
  confusions: readonly Confusion[];
  grade: AnswerGrade;
  now: Date;
}): {
  session: StudySession;
  state: PromptState;
  confusions: Confusion[];
  outcome: StudyOutcome;
  contrastQueued: boolean;
} {
  const { grade, now } = args;
  const entry: PromptEntry = { kind: 'prompt', itemKey: args.state.itemKey, promptType: args.state.promptType };

  let state: PromptState;
  let outcome: StudyOutcome;
  if (args.state.phase === 'review') {
    state = applyReview(args.state, reviewGradeFor(grade), now);
    outcome = grade.correct ? 'reviewed' : 'lapsed';
  } else {
    const r = applyLearningAnswer(args.state, grade.correct);
    if (r.outcome === 'graduate') {
      state = graduate(r.state, now);
      outcome = 'graduated';
    } else {
      state = r.state;
      outcome = r.outcome;
    }
  }

  let session = recordPromptAnswered(args.session, entry, grade.correct);
  let confusions = [...args.confusions];
  let contrastQueued = false;
  if (!grade.correct && grade.answeredItemKey && grade.answeredItemKey !== entry.itemKey) {
    const rec = recordConfusion(confusions, entry.itemKey, grade.answeredItemKey);
    confusions = rec.confusions;
    if (shouldInjectContrast(rec.count)) {
      session = queueContrast(session, { kind: 'contrast', itemKey: entry.itemKey, otherKey: grade.answeredItemKey });
      contrastQueued = true;
    }
  }

  return { session, state, confusions, outcome, contrastQueued };
}

/**
 * Marks the intro card as seen: every prompt of the item enters learning at rung 1.
 * `states` must contain exactly one `PromptState` per item × prompt type of the
 * course (see `initialStates`/`hydrateStates`).
 */
export function applyIntro(args: {
  session: StudySession;
  itemKey: string;
  states: readonly PromptState[];
  /** Level the item's new prompts start at (placement head start); default 1. */
  rung?: 1 | 2;
}): { session: StudySession; states: PromptState[] } {
  return {
    session: recordIntroServed(args.session, args.itemKey),
    states: args.states.map((s) => {
      if (s.itemKey !== args.itemKey || s.phase !== 'new') return s;
      return { ...introduce(s), rung: args.rung ?? 1 };
    }),
  };
}

/** Contrast drills are logged by the caller but never move the ladder. */
export function applyContrast(session: StudySession): StudySession {
  return recordContrastServed(session);
}
