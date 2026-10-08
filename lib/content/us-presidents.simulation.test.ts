import { describe, expect, it } from 'vitest';
import {
  applyContrast,
  applyIntro,
  applyPlacementAnswer,
  applyStudyAnswer,
  initialStates,
  isExamReady,
  isSessionComplete,
  nextEntry,
  startStudySession,
  stateKey,
  type AnswerGrade,
  type Confusion,
  type PromptState,
} from '@/lib/engine';
import { days } from '@/lib/engine/test-fixtures';
import { US_PRESIDENTS } from './us-presidents';

const course = US_PRESIDENTS;

/**
 * A learner who knows the sequence (perfect placement) and learns every face, year and party
 * first time, except Polk's start year: they answer 1849 (Taylor's) the first 2 times.
 * Two 20-answer sessions a day.
 */
function simulate(totalDays: number) {
  let states: PromptState[] = initialStates(course);
  for (const item of course.items) {
    states = applyPlacementAnswer({ course, states, itemKey: item.key, correct: true, now: days(-1) });
  }
  const afterPlacement = states;
  let confusions: Confusion[] = [];
  let polkMissesLeft = 2;
  const intros: string[] = [];
  const contrasts: string[] = [];
  const askedTypes = new Set<string>();

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
        askedTypes.add(entry.promptType);
        const miss = entry.itemKey === 'polk' && entry.promptType === 'start_year' && polkMissesLeft > 0;
        if (miss) polkMissesLeft--;
        const grade: AnswerGrade = miss
          ? { correct: false, typo: false, answeredItemKey: 'taylor' }
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
  return { afterPlacement, states, confusions, intros, contrasts, askedTypes };
}

describe('US Presidents learner simulation', () => {
  const result = simulate(30);
  const inReview = (states: PromptState[], promptType: string) =>
    states.filter((s) => s.promptType === promptType && s.phase === 'review').length;

  it('graduates Number → Name and Sequence in placement, and nothing else', () => {
    expect(inReview(result.afterPlacement, 'number_to_name')).toBe(45);
    expect(inReview(result.afterPlacement, 'sequence')).toBe(45);
    for (const pt of ['portrait_to_name', 'name_to_portrait', 'start_year', 'party']) {
      expect(inReview(result.afterPlacement, pt)).toBe(0);
    }
  });

  it('introduces placed presidents for their faces, years and party, chronologically and once each', () => {
    expect(new Set(result.intros).size).toBe(result.intros.length);
    expect(result.intros.slice(0, 3)).toEqual(['washington', 'j-adams', 'jefferson']);
    for (const pt of ['portrait_to_name', 'name_to_portrait', 'start_year', 'party']) expect(result.askedTypes).toContain(pt);
  });

  it('records the Polk → Taylor start-year mix-up and runs a contrast drill', () => {
    expect(result.confusions).toContainEqual({ asked: 'polk', answered: 'taylor', count: 2 });
    expect(result.contrasts).toContain('polk>taylor');
  });

  it('gets a diligent learner to exam-ready within 30 days', () => {
    // Observed when written: all 180 post-placement prompts (45 × faces ×2, year, party) in review.
    expect(isExamReady(course, result.states)).toBe(true);
  });
});
