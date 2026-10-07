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
import { WORLD_MAP } from './world-map';

const course = WORLD_MAP;
const PLACED_REGIONS = 6;

/**
 * A learner who already knows the first six regions (placed by clicking) and nothing after, and
 * names Bolivia "Peru" the first 2 times. Two 20-answer sessions a day.
 */
function simulate(totalDays: number) {
  let states: PromptState[] = initialStates(course);
  for (const item of course.items.filter((i) => i.groupOrder <= PLACED_REGIONS)) {
    states = applyPlacementAnswer({ course, states, itemKey: item.key, correct: true, now: days(-1) });
  }
  const afterPlacement = states;
  let confusions: Confusion[] = [];
  let boliviaMissesLeft = 2;
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
          ({ session, states } = applyIntro({ session, itemKey: entry.itemKey, states }));
          continue;
        }
        if (entry.kind === 'contrast') {
          contrasts.push(`${entry.itemKey}>${entry.otherKey}`);
          session = applyContrast(session);
          continue;
        }
        const miss = entry.itemKey === 'BO' && entry.promptType === 'name' && boliviaMissesLeft > 0;
        if (miss) boliviaMissesLeft--;
        const grade: AnswerGrade = miss
          ? { correct: false, typo: false, answeredItemKey: 'PE' }
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

describe('World Map learner simulation (Find and Name only)', () => {
  const result = simulate(30);
  const placedKeys = new Set(course.items.filter((i) => i.groupOrder <= PLACED_REGIONS).map((i) => i.key));
  const learnedItems = (states: PromptState[]) =>
    course.items.filter((i) => states.filter((s) => s.itemKey === i.key).every((s) => s.phase === 'review')).length;

  it('places whole items: both prompts of every placed country are learned, the rest untouched', () => {
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

  it('records the Bolivia → Peru mix-up and runs a contrast drill', () => {
    expect(result.confusions).toContainEqual({ asked: 'BO', answered: 'PE', count: 2 });
    expect(result.contrasts).toContain('BO>PE');
  });

  it('keeps learning the unplaced regions', () => {
    // Observed when written: 77 of the 119 unplaced countries fully learned (both prompts) in 30 days.
    expect(learnedItems(result.states) - placedKeys.size).toBeGreaterThanOrEqual(65);
  });
});
