import { describe, expect, it } from 'vitest';
import { applyContrast, applyIntro, applyStudyAnswer } from './answer';
import { graduate } from './scheduler';
import { queueContrast, startStudySession } from './session';
import { initialStates, newPromptState } from './state';
import { NOW } from './test-fixtures';
import type { AnswerGrade, Confusion, PromptState, Rung } from './types';

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
});

describe('applyIntro', () => {
  it('introduces every prompt of the item and counts the intro', () => {
    const states = initialStates({
      slug: 't',
      title: 't',
      placementPromptType: 'flag_to_name',
      promptTypes: [
        { id: 'flag_to_name', label: '', formats: { 1: { format: 'typed' }, 2: { format: 'typed' }, 3: { format: 'typed' } } },
        { id: 'name_to_flag', label: '', formats: { 1: { format: 'typed' }, 2: { format: 'typed' }, 3: { format: 'typed' } } },
      ],
      items: [{ key: 'TD', name: 'Chad', aliases: [], group: 'g', groupOrder: 1, itemOrder: 1, lookalikes: [] }],
    });
    const r = applyIntro({ session: startStudySession(), itemKey: 'TD', states });
    expect(r.states.every((s) => s.phase === 'learning' && s.rung === 1)).toBe(true);
    expect(r.session.newItemsIntroduced).toBe(1);
    expect(r.session.answered).toBe(0);
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
