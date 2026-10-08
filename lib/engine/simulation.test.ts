import { describe, expect, it } from 'vitest';
import {
  applyContrast,
  applyIntro,
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
} from './index';
import { days, TEST_COURSE } from './test-fixtures';

/**
 * Learner who knows every flag except Ecuador, which they mistake for
 * Colombia the first 4 times they're asked. Two sessions per day.
 */
function simulate(totalDays: number) {
  let states: PromptState[] = initialStates(TEST_COURSE);
  let confusions: Confusion[] = [];
  let ecuadorMissesLeft = 4;
  const asksByDay: string[][] = [];
  const contrasts: string[] = [];

  for (let day = 0; day < totalDays; day++) {
    asksByDay[day] = [];
    for (const hour of [0, 8]) {
      const now = days(day, hour);
      let session = startStudySession();
      for (let guard = 0; guard < 500; guard++) {
        const entry = nextEntry({ course: TEST_COURSE, states, session, now });
        if (!entry) break;
        if (entry.kind === 'intro') {
          ({ session, states } = applyIntro({ session, itemKey: entry.itemKey, states, course: TEST_COURSE }));
          continue;
        }
        if (entry.kind === 'contrast') {
          contrasts.push(`${entry.itemKey}>${entry.otherKey}`);
          session = applyContrast(session);
          continue;
        }
        asksByDay[day].push(entry.itemKey);
        const wrong = entry.itemKey === 'EC' && ecuadorMissesLeft > 0;
        if (wrong) ecuadorMissesLeft--;
        const grade: AnswerGrade = wrong
          ? { correct: false, typo: false, answeredItemKey: 'CO' }
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
  return { states, confusions, asksByDay, contrasts };
}

describe('learner simulation', () => {
  const result = simulate(30);
  const total = (key: string) => result.asksByDay.flat().filter((k) => k === key).length;

  it('asks the missed item more often than a known one', () => {
    expect(total('EC')).toBeGreaterThan(total('US'));
  });

  it('records the Ecuador→Colombia confusion and runs a contrast drill', () => {
    expect(result.confusions).toContainEqual({ asked: 'EC', answered: 'CO', count: 4 });
    expect(result.contrasts).toContain('EC>CO');
  });

  it('lets a known item fade: US is rarely asked in the last 10 days', () => {
    const lateAsks = result.asksByDay.slice(20).flat().filter((k) => k === 'US').length;
    expect(lateAsks).toBeLessThanOrEqual(2);
  });

  it('gets a diligent learner to exam-ready within 30 days', () => {
    expect(isExamReady(TEST_COURSE, result.states)).toBe(true);
  });
});
