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

/**
 * A learner who already knows where every country is (perfect placement) and learns every
 * capital first time, except Bolivia's: they answer "Lima" (Peru's) the first 2 times.
 * Two 20-answer sessions a day.
 */
function simulate(totalDays: number) {
  let states: PromptState[] = initialStates(course);
  for (const item of course.items) {
    states = applyPlacementAnswer({ course, states, itemKey: item.key, correct: true, now: days(-1) });
  }
  const afterPlacement = states;
  let confusions: Confusion[] = [];
  let boliviaMissesLeft = 2;
  const intros: string[] = [];
  const contrasts: string[] = [];
  const asked: { day: number; itemKey: string; promptType: string }[] = [];

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
        asked.push({ day, itemKey: entry.itemKey, promptType: entry.promptType });
        const miss = entry.itemKey === 'BO' && entry.promptType === 'capital' && boliviaMissesLeft > 0;
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
  return { afterPlacement, states, confusions, intros, contrasts, asked };
}

describe('World Map learner simulation', () => {
  const result = simulate(30);
  const phases = (states: PromptState[], promptType: string) =>
    states.filter((s) => s.promptType === promptType).map((s) => s.phase);

  it('graduates Find and Name in placement and leaves every Capital new', () => {
    expect(new Set(phases(result.afterPlacement, 'find'))).toEqual(new Set(['review']));
    expect(new Set(phases(result.afterPlacement, 'name'))).toEqual(new Set(['review']));
    expect(new Set(phases(result.afterPlacement, 'capital'))).toEqual(new Set(['new']));
  });

  it('introduces each placed item once, for its capital, in course order', () => {
    expect(new Set(result.intros).size).toBe(result.intros.length);
    expect(result.intros.slice(0, 3)).toEqual(course.items.slice(0, 3).map((i) => i.key));
  });

  it('records the Bolivia → Peru capital confusion and runs a contrast drill', () => {
    expect(result.confusions).toContainEqual({ asked: 'BO', answered: 'PE', count: 2 });
    expect(result.contrasts).toContain('BO>PE');
  });

  it('keeps reviewing placed Find and Name prompts while capitals are learned', () => {
    expect(result.asked.some((a) => a.promptType === 'find')).toBe(true);
    expect(result.asked.some((a) => a.promptType === 'name')).toBe(true);
  });

  it('steadily learns capitals: over half in review within 30 days', () => {
    // Observed: 111 of 208 (2 x 20-answer sessions a day) with the engine config when written.
    const learned = phases(result.states, 'capital').filter((p) => p === 'review').length;
    expect(learned).toBeGreaterThanOrEqual(100);
  });
});
