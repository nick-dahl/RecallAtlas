import { describe, expect, it } from 'vitest';
import {
  applyContrast,
  applyIntro,
  applyPlacementAnswer,
  applyStudyAnswer,
  ENGINE_CONFIG,
  initialStates,
  isSessionComplete,
  nextEntry,
  startStudySession,
  stateKey,
  type AnswerGrade,
  type Confusion,
  type PromptState,
} from '@/lib/engine';
import { days } from '@/lib/engine/test-fixtures';
import { GREAT_PAINTINGS } from './great-paintings';

const course = GREAT_PAINTINGS;
const PLACED = 30;

/**
 * A learner who can name the 30 most famous paintings at placement and nothing else, and who says
 * Pieter de Hooch painted The Milkmaid the first 2 times. Two 20-answer sessions a day.
 */
function simulate(totalDays: number) {
  let states: PromptState[] = initialStates(course);
  const placed = course.items.filter((i) => i.itemOrder <= PLACED);
  for (const item of placed) {
    states = applyPlacementAnswer({ course, states, itemKey: item.key, correct: true, now: days(-1) });
  }
  const afterPlacement = states;
  let confusions: Confusion[] = [];
  let milkmaidMissesLeft = 2;
  const intros: string[] = [];
  const contrasts: string[] = [];
  const firstRung = new Map<string, number>();
  let maxLearning = 0;

  for (let day = 0; day < totalDays; day++) {
    for (const hour of [0, 8]) {
      const now = days(day, hour);
      let session = startStudySession();
      for (let guard = 0; guard < 500; guard++) {
        const entry = nextEntry({ course, states, session, now });
        if (!entry) break;
        if (entry.kind === 'intro') {
          intros.push(entry.itemKey);
          // As the study service does: an item placement partly fast-tracked starts its other prompts higher.
          const partlyPlaced = states.some((s) => s.itemKey === entry.itemKey && s.phase !== 'new');
          ({ session, states } = applyIntro({ session, itemKey: entry.itemKey, states, rung: partlyPlaced ? 2 : 1 }));
        } else if (entry.kind === 'contrast') {
          contrasts.push(`${entry.itemKey}>${entry.otherKey}`);
          session = applyContrast(session);
        } else {
          const key = stateKey(entry.itemKey, entry.promptType);
          const current = states.find((s) => stateKey(s.itemKey, s.promptType) === key)!;
          if (!firstRung.has(key)) firstRung.set(key, current.rung);
          const miss = entry.itemKey === 'milkmaid' && entry.promptType === 'image_to_artist' && milkmaidMissesLeft > 0;
          if (miss) milkmaidMissesLeft--;
          const grade: AnswerGrade = miss
            ? { correct: false, typo: false, answeredItemKey: 'courtyard-delft' }
            : { correct: true, typo: false, answeredItemKey: null };
          const r = applyStudyAnswer({ session, state: current, confusions, grade, now });
          session = r.session;
          confusions = r.confusions;
          states = states.map((s) => (stateKey(s.itemKey, s.promptType) === key ? r.state : s));
        }
        maxLearning = Math.max(maxLearning, states.filter((s) => s.phase === 'learning').length);
        if (isSessionComplete(session)) break;
      }
    }
  }
  return {
    placed: new Set(placed.map((i) => i.key)),
    afterPlacement,
    states,
    confusions,
    intros,
    contrasts,
    maxLearning,
    firstRungOf: (itemKey: string, promptType: string) => firstRung.get(stateKey(itemKey, promptType)),
  };
}

describe('Great Paintings learner simulation', () => {
  const result = simulate(14);
  const learnedItems = (states: PromptState[]) =>
    course.items.filter((i) => states.filter((s) => s.itemKey === i.key).every((s) => s.phase === 'review')).length;

  it('places the title prompts only: artist and movement of placed paintings stay to learn', () => {
    for (const s of result.afterPlacement) {
      const titled = s.promptType === 'image_to_title' || s.promptType === 'title_to_image';
      expect(s.phase).toBe(result.placed.has(s.itemKey) && titled ? 'review' : 'new');
    }
  });

  it('introduces in fame order, placed paintings included, each once', () => {
    expect(new Set(result.intros).size).toBe(result.intros.length);
    expect(result.intros.slice(0, 3)).toEqual(['mona-lisa', 'starry-night', 'last-supper']);
  });

  it('starts the placed paintings’ artist and movement at level 2, the others at level 1', () => {
    expect(result.firstRungOf('mona-lisa', 'image_to_artist')).toBe(2);
    expect(result.firstRungOf('mona-lisa', 'image_to_movement')).toBe(2);
    const unplaced = result.intros.find((k) => !result.placed.has(k))!;
    expect(result.firstRungOf(unplaced, 'image_to_title')).toBe(1);
  });

  it('never floods learning after a generous placement (Review Focus 5)', () => {
    expect(result.maxLearning).toBeLessThanOrEqual(ENGINE_CONFIG.maxLearningPrompts + course.promptTypes.length);
  });

  it('records the Milkmaid → de Hooch mix-up and runs a contrast drill', () => {
    expect(result.confusions).toContainEqual({ asked: 'milkmaid', answered: 'courtyard-delft', count: 2 });
    expect(result.contrasts).toContain('milkmaid>courtyard-delft');
  });

  it('keeps learning paintings', () => {
    // Observed when written: 42 paintings fully learned (all four prompts) in 14 days.
    expect(learnedItems(result.states)).toBeGreaterThanOrEqual(36);
  });
});
