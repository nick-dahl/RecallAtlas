import { describe, expect, it } from 'vitest';
import {
  applyContrast,
  applyIntro,
  applyPlacementAnswer,
  applyStudyAnswer,
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
import { WORLD_CAPITALS } from './world-capitals';

const course = WORLD_CAPITALS;
const PLACED_REGIONS = 3;

/**
 * A learner who knows the first three regions' capitals at placement and nothing after, and
 * answers "Slovenia" for Bratislava the first 2 times. Two 20-answer sessions a day.
 */
function simulate(totalDays: number) {
  let states: PromptState[] = initialStates(course);
  for (const item of course.items.filter((i) => i.groupOrder <= PLACED_REGIONS)) {
    states = applyPlacementAnswer({ course, states, itemKey: item.key, correct: true, now: days(-1) });
  }
  const afterPlacement = states;
  let confusions: Confusion[] = [];
  let slovakiaMissesLeft = 2;
  const intros: string[] = [];
  const contrasts: string[] = [];

  for (let day = 0; day < totalDays; day++) {
    for (const hour of [0, 8]) {
      const now = days(day, hour);
      let session = startStudySession();
      for (let guard = 0; guard < 500; guard++) {
        const entry = nextEntry({ course, states, session, now });
        if (!entry) break;
        if (entry.kind === 'intro') {
          intros.push(entry.itemKey);
          ({ session, states } = applyIntro({ session, itemKey: entry.itemKey, states, course }));
          continue;
        }
        if (entry.kind === 'contrast') {
          contrasts.push(`${entry.itemKey}>${entry.otherKey}`);
          session = applyContrast(session);
          continue;
        }
        const miss = entry.itemKey === 'SK' && entry.promptType === 'capital_to_country' && slovakiaMissesLeft > 0;
        if (miss) slovakiaMissesLeft--;
        const grade: AnswerGrade = miss
          ? { correct: false, typo: false, answeredItemKey: 'SI' }
          : { correct: true, typo: false, answeredItemKey: null };
        const key = stateKey(entry.itemKey, entry.promptType);
        const current = states.find((s) => stateKey(s.itemKey, s.promptType) === key)!;
        const r = applyStudyAnswer({ session, state: current, confusions, grade, now });
        session = r.session;
        confusions = r.confusions;
        states = states.map((s) => (stateKey(s.itemKey, s.promptType) === key ? r.state : s));
        if (isSessionComplete(session)) break;
      }
    }
  }
  return { afterPlacement, states, confusions, intros, contrasts };
}

describe('World Capitals learner simulation', () => {
  const result = simulate(30);
  const placedKeys = new Set(course.items.filter((i) => i.groupOrder <= PLACED_REGIONS).map((i) => i.key));
  const learnedItems = (states: PromptState[]) =>
    course.items.filter((i) => states.filter((s) => s.itemKey === i.key).every((s) => s.phase === 'review')).length;

  it('places whole items: both directions of every placed country are learned, the rest untouched', () => {
    for (const s of result.afterPlacement) expect(s.phase).toBe(placedKeys.has(s.itemKey) ? 'review' : 'new');
  });

  it('introduces only unplaced countries, once each, in course order', () => {
    expect(result.intros.every((k) => !placedKeys.has(k))).toBe(true);
    expect(new Set(result.intros).size).toBe(result.intros.length);
    const unplaced = course.items
      .filter((i) => !placedKeys.has(i.key))
      .sort((a, b) => a.groupOrder - b.groupOrder || a.itemOrder - b.itemOrder);
    expect(result.intros.slice(0, 3)).toEqual(unplaced.slice(0, 3).map((i) => i.key));
  });

  it('records the Bratislava → Slovenia mix-up and runs a contrast drill', () => {
    expect(result.confusions).toContainEqual({ asked: 'SK', answered: 'SI', count: 2 });
    expect(result.contrasts).toContain('SK>SI');
  });

  it('keeps learning the unplaced regions', () => {
    // Observed with quick start: 145 of the 151 unplaced countries fully learned (both directions) in 30 days (92 before).
    expect(learnedItems(result.states) - placedKeys.size).toBeGreaterThanOrEqual(123);
  });

});
