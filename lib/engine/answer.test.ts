import { describe, expect, it } from 'vitest';
import { applyContrast, applyIntro, applyStudyAnswer } from './answer';
import { graduate } from './scheduler';
import { queueContrast, startStudySession } from './session';
import { initialStates, newPromptState } from './state';
import { NOW } from './test-fixtures';
import type { AnswerGrade, Confusion, CourseDef, PromptState, Rung } from './types';

const RIGHT: AnswerGrade = { correct: true, typo: false, answeredItemKey: null };
const TYPO: AnswerGrade = { correct: true, typo: true, answeredItemKey: null };
const WRONG_RO: AnswerGrade = { correct: false, typo: false, answeredItemKey: 'RO' };

const learning = (rung: Rung, streak = 0): PromptState => ({
  ...newPromptState('TD', 'flag_to_name'),
  phase: 'learning',
  rung,
  streak,
});
const review = (): PromptState => graduate(learning(3), NOW);

function answer(state: PromptState, grade: AnswerGrade, confusions: Confusion[] = [], now = NOW) {
  return applyStudyAnswer({ session: startStudySession(), state, confusions, grade, now });
}

describe('applyStudyAnswer', () => {
  it('climbs the ladder in learning', () => {
    const r = answer(learning(1), RIGHT);
    expect(r.outcome).toBe('climbed');
    expect(r.state.rung).toBe(2);
    expect(r.session.answered).toBe(1);
  });

  it('graduates into review after a correct recall', () => {
    const r = answer(learning(3), RIGHT);
    expect(r.outcome).toBe('graduated');
    expect(r.state.phase).toBe('review');
    expect(r.state.fsrs).not.toBeNull();
  });

  it('reviews: correct → reviewed; typo schedules sooner than clean', () => {
    const s = review();
    const at = s.fsrs!.due;
    const clean = answer(s, RIGHT, [], at);
    const typo = answer(s, TYPO, [], at);
    expect(clean.outcome).toBe('reviewed');
    expect(typo.state.fsrs!.due.getTime()).toBeLessThan(clean.state.fsrs!.due.getTime());
  });

  it('reviews: wrong → lapsed back to learning rung 2', () => {
    const r = answer(review(), WRONG_RO);
    expect(r.outcome).toBe('lapsed');
    expect(r.state).toMatchObject({ phase: 'learning', rung: 2 });
  });

  it('records a confusion on the first miss without queueing a drill', () => {
    const r = answer(learning(2), WRONG_RO);
    expect(r.confusions).toEqual([{ asked: 'TD', answered: 'RO', count: 1 }]);
    expect(r.contrastQueued).toBe(false);
    expect(r.session.pending).toEqual([]);
  });

  it('queues a contrast drill when the pair reaches the threshold', () => {
    const r = answer(learning(2), WRONG_RO, [{ asked: 'TD', answered: 'RO', count: 1 }]);
    expect(r.contrastQueued).toBe(true);
    expect(r.session.pending).toEqual([{ kind: 'contrast', itemKey: 'TD', otherKey: 'RO' }]);
  });

  it('does not record a confusion for "I don\'t know"', () => {
    const r = answer(learning(2), { correct: false, typo: false, answeredItemKey: null });
    expect(r.confusions).toEqual([]);
  });

  it('holds at the same rung on a correct answer that does not clear the streak', () => {
    const r = answer(learning(2, 0), RIGHT);
    expect(r.outcome).toBe('held');
    expect(r.state.rung).toBe(2);
    expect(r.state.streak).toBe(1);
  });

  it('lapses a review AND queues a contrast drill when the miss is a known confusion', () => {
    const r = answer(review(), WRONG_RO, [{ asked: 'TD', answered: 'RO', count: 1 }]);
    expect(r.outcome).toBe('lapsed');
    expect(r.state).toMatchObject({ phase: 'learning', rung: 2 });
    expect(r.contrastQueued).toBe(true);
    expect(r.session.pending).toEqual([{ kind: 'contrast', itemKey: 'TD', otherKey: 'RO' }]);
  });
});

describe('applyIntro', () => {
  const course = {
    slug: 't',
    title: 't',
    placementPromptType: 'flag_to_name',
    promptTypes: [
      { id: 'flag_to_name', label: '', formats: { 1: { format: 'typed' }, 2: { format: 'typed' }, 3: { format: 'typed' } } },
      { id: 'sequence', label: '', fullLadder: true, formats: { 1: { format: 'typed' }, 2: { format: 'typed' }, 3: { format: 'typed' } } },
    ],
    items: [{ key: 'TD', name: 'Chad', aliases: [], group: 'g', groupOrder: 1, itemOrder: 1, lookalikes: [] }],
  } satisfies CourseDef;
  const intro = () => applyIntro({ session: startStudySession(), itemKey: 'TD', states: initialStates(course), course });
  const stateOf = (states: PromptState[], id: string) => states.find((s) => s.promptType === id)!;

  it('starts a new prompt at level 2 with one correct answer banked, and counts the intro', () => {
    const r = intro();
    expect(stateOf(r.states, 'flag_to_name')).toMatchObject({ phase: 'learning', rung: 2, streak: 1 });
    expect(r.session.newItemsIntroduced).toBe(1);
    expect(r.session.answered).toBe(0);
  });

  it('keeps the full ladder (level 1, nothing banked) for prompt types that opt out', () => {
    expect(stateOf(intro().states, 'sequence')).toMatchObject({ phase: 'learning', rung: 1, streak: 0 });
  });

  it('right first time goes straight to the top level; wrong first time drops to level 1 as before', () => {
    const fresh = stateOf(intro().states, 'flag_to_name');
    const right = applyStudyAnswer({ session: startStudySession(), state: fresh, confusions: [], grade: RIGHT, now: NOW });
    expect(right.state).toMatchObject({ rung: 3, streak: 0 });
    const wrong = applyStudyAnswer({ session: startStudySession(), state: fresh, confusions: [], grade: WRONG_RO, now: NOW });
    expect(wrong.state).toMatchObject({ rung: 1, streak: 0 });
  });
});

describe('applyContrast', () => {
  it('pops the pending drill without counting an answer', () => {
    const session = queueContrast(startStudySession(), { kind: 'contrast', itemKey: 'TD', otherKey: 'RO' });
    const next = applyContrast(session);
    expect(next.pending).toEqual([]);
    expect(next.answered).toBe(0);
  });
});
