import { describe, expect, it } from 'vitest';
import { introduce } from './ladder';
import { graduate } from './scheduler';
import {
  canIntroduce,
  isSessionComplete,
  newItemsInOrder,
  nextEntry,
  queueContrast,
  recordContrastServed,
  recordIntroServed,
  recordPromptAnswered,
  startStudySession,
} from './session';
import { initialStates, stateKey } from './state';
import { applyPlacementAnswer } from './placement';
import { days, NOW, TEST_COURSE, TEST_MAP_COURSE } from './test-fixtures';
import type { PromptState } from './types';

const course = TEST_COURSE;

function update(states: PromptState[], keys: string[], fn: (s: PromptState) => PromptState): PromptState[] {
  const set = new Set(keys);
  return states.map((s) => (set.has(s.itemKey) ? fn(s) : s));
}
const toLearning = (s: PromptState) => introduce(s);
const toReviewLongAgo = (s: PromptState) => graduate({ ...introduce(s), rung: 3 }, days(-30));
const toReviewJustNow = (s: PromptState) => graduate({ ...introduce(s), rung: 3 }, NOW);

describe('nextEntry', () => {
  it('starts a fresh course by introducing the first item in group order', () => {
    const states = initialStates(course);
    expect(nextEntry({ course, states, session: startStudySession(), now: NOW })).toEqual({ kind: 'intro', itemKey: 'US' });
  });

  it('introduces cooldown+1 items before asking the first one', () => {
    let states = initialStates(course);
    let session = startStudySession();
    const served: string[] = [];
    for (let i = 0; i < 10; i++) {
      const e = nextEntry({ course, states, session, now: NOW })!;
      if (e.kind !== 'intro') {
        served.push(`ask:${e.itemKey}`);
        break;
      }
      served.push(`intro:${e.itemKey}`);
      states = update(states, [e.itemKey], toLearning);
      session = recordIntroServed(session, e.itemKey);
    }
    expect(served).toEqual(['intro:US', 'intro:EC', 'intro:CO', 'intro:VE', 'ask:US']);
  });

  it('serves due reviews before learning prompts', () => {
    let states = initialStates(course);
    states = update(states, ['EC'], toLearning);
    states = update(states, ['TD'], toReviewLongAgo);
    const e = nextEntry({ course, states, session: startStudySession(), now: NOW });
    expect(e).toMatchObject({ kind: 'prompt', itemKey: 'TD' });
  });

  it('serves a fresh miss off cooldown before a due review', () => {
    const states = initialStates(course).map((s) => (s.itemKey === 'TD' ? toLearning(s) : toReviewLongAgo(s)));
    let session = startStudySession();
    session = recordPromptAnswered(session, { kind: 'prompt', itemKey: 'TD', promptType: 'flag_to_name' }, false);
    for (const k of ['US', 'EC', 'CO']) {
      session = recordPromptAnswered(session, { kind: 'prompt', itemKey: k, promptType: 'flag_to_name' }, true);
    }
    expect(nextEntry({ course, states, session, now: NOW })).toEqual({
      kind: 'prompt',
      itemKey: 'TD',
      promptType: 'flag_to_name',
    });
  });

  it('prefers a prompt that was just missed once it is off cooldown', () => {
    let states = initialStates(course);
    states = update(states, ['US', 'EC', 'CO', 'VE', 'PE'], toLearning);
    let session = startStudySession();
    session = recordPromptAnswered(session, { kind: 'prompt', itemKey: 'PE', promptType: 'flag_to_name' }, false);
    for (const k of ['US', 'EC', 'CO']) {
      session = recordPromptAnswered(session, { kind: 'prompt', itemKey: k, promptType: 'flag_to_name' }, true);
    }
    expect(nextEntry({ course, states, session, now: NOW })).toEqual({
      kind: 'prompt',
      itemKey: 'PE',
      promptType: 'flag_to_name',
    });
  });

  it('never serves an item on cooldown when something else is eligible', () => {
    let states = initialStates(course);
    states = update(states, ['US', 'EC', 'CO', 'VE'], toLearning);
    let session = startStudySession();
    session = recordPromptAnswered(session, { kind: 'prompt', itemKey: 'US', promptType: 'flag_to_name' }, true);
    const e = nextEntry({ course, states, session, now: NOW });
    expect(e?.itemKey).not.toBe('US');
  });

  it('serves a pending contrast drill first', () => {
    const session = queueContrast(startStudySession(), { kind: 'contrast', itemKey: 'TD', otherKey: 'RO' });
    expect(nextEntry({ course, states: initialStates(course), session, now: NOW })).toEqual({
      kind: 'contrast',
      itemKey: 'TD',
      otherKey: 'RO',
    });
    expect(recordContrastServed(session).pending).toEqual([]);
  });

  it('returns null when nothing is due, learning, or new', () => {
    const states = initialStates(course).map(toReviewJustNow);
    expect(nextEntry({ course, states, session: startStudySession(), now: NOW })).toBeNull();
  });

  it('practice-ahead mode serves not-yet-due reviews', () => {
    const states = initialStates(course).map(toReviewJustNow);
    const e = nextEntry({ course, states, session: startStudySession({ mode: 'practice-ahead' }), now: days(1) });
    expect(e?.kind).toBe('prompt');
  });

  it('falls back to a straggler prompt when only the last-served item remains in learning', () => {
    const states = initialStates(course).map((s) => (s.itemKey === 'LC' ? toLearning(s) : toReviewJustNow(s)));
    let session = startStudySession();
    session = recordPromptAnswered(session, { kind: 'prompt', itemKey: 'LC', promptType: 'flag_to_name' }, true);
    expect(nextEntry({ course, states, session, now: NOW })).toEqual({
      kind: 'prompt',
      itemKey: 'LC',
      promptType: 'name_to_flag',
    });
  });

  it('excludes the most recently asked prompt overall from the straggler fallback, even after a drill', () => {
    // Every prompt is a not-yet-due review except LC, which has only
    // flag_to_name in learning (name_to_flag already graduated).
    const states = initialStates(course).map((s) =>
      s.itemKey === 'LC' && s.promptType === 'flag_to_name' ? toLearning(s) : toReviewJustNow(s),
    );
    let session = startStudySession();
    // LC:flag_to_name is answered wrong, then a contrast drill is queued and served.
    // Both advance `turn`, so LC:flag_to_name is the most recently asked prompt
    // even though it is no longer the entry most recently returned by nextEntry.
    session = recordPromptAnswered(session, { kind: 'prompt', itemKey: 'LC', promptType: 'flag_to_name' }, false);
    session = queueContrast(session, { kind: 'contrast', itemKey: 'LC', otherKey: 'DO' });
    session = recordContrastServed(session);
    expect(nextEntry({ course, states, session, now: NOW })).toBeNull();
  });
});

describe('canIntroduce', () => {
  it('allows introductions in a fresh session', () => {
    expect(canIntroduce(course, initialStates(course), startStudySession())).toBe(true);
  });

  it('blocks when too many prompts are in learning', () => {
    const states = update(initialStates(course), ['US', 'EC', 'CO', 'VE', 'PE', 'TD', 'RO', 'NE'], toLearning);
    expect(states.filter((s) => s.phase === 'learning')).toHaveLength(16);
    expect(canIntroduce(course, states, startStudySession())).toBe(false);
  });

  it('blocks after the per-session new-item cap', () => {
    let session = startStudySession();
    for (const k of ['US', 'EC', 'CO', 'VE', 'PE']) session = recordIntroServed(session, k);
    expect(canIntroduce(course, initialStates(course), session)).toBe(false);
  });

  it('blocks when too few answers remain to ask the new prompts', () => {
    let session = startStudySession({ size: 3 });
    session = recordPromptAnswered(session, { kind: 'prompt', itemKey: 'US', promptType: 'flag_to_name' }, true);
    session = recordPromptAnswered(session, { kind: 'prompt', itemKey: 'US', promptType: 'name_to_flag' }, true);
    expect(canIntroduce(course, initialStates(course), session)).toBe(false);
  });

  it('blocks when too few turns remain for an intro to clear cooldown (size 5, remaining 3)', () => {
    let session = startStudySession({ size: 5 });
    session = recordPromptAnswered(session, { kind: 'prompt', itemKey: 'US', promptType: 'flag_to_name' }, true);
    session = recordPromptAnswered(session, { kind: 'prompt', itemKey: 'EC', promptType: 'flag_to_name' }, true);
    expect(canIntroduce(course, initialStates(course), session)).toBe(false);
  });

  it('allows introductions when enough turns remain to clear cooldown (size 6, remaining 4)', () => {
    let session = startStudySession({ size: 6 });
    session = recordPromptAnswered(session, { kind: 'prompt', itemKey: 'US', promptType: 'flag_to_name' }, true);
    session = recordPromptAnswered(session, { kind: 'prompt', itemKey: 'EC', promptType: 'flag_to_name' }, true);
    expect(canIntroduce(course, initialStates(course), session)).toBe(true);
  });
});

describe('session bookkeeping', () => {
  it('completes after `size` graded answers', () => {
    let session = startStudySession({ size: 2 });
    expect(isSessionComplete(session)).toBe(false);
    session = recordPromptAnswered(session, { kind: 'prompt', itemKey: 'US', promptType: 'flag_to_name' }, true);
    session = recordPromptAnswered(session, { kind: 'prompt', itemKey: 'EC', promptType: 'flag_to_name' }, true);
    expect(isSessionComplete(session)).toBe(true);
  });

  it('tracks last-asked turn and missed flag per prompt', () => {
    const s = recordPromptAnswered(startStudySession(), { kind: 'prompt', itemKey: 'EC', promptType: 'flag_to_name' }, false);
    expect(s.lastAsked[stateKey('EC', 'flag_to_name')]).toBe(0);
    expect(s.lastMissed[stateKey('EC', 'flag_to_name')]).toBe(true);
    expect(s.recentItems).toEqual(['EC']);
  });
});

describe('partially placed items', () => {
  const placed = () =>
    applyPlacementAnswer({ course: TEST_MAP_COURSE, states: initialStates(TEST_MAP_COURSE), itemKey: 'US', correct: true, now: NOW });

  it('still counts an item with a new capital as new', () => {
    expect(newItemsInOrder(TEST_MAP_COURSE, placed())[0].key).toBe('US');
  });

  it('introduces it in study, which moves only its capital into learning', () => {
    const states = placed();
    expect(nextEntry({ course: TEST_MAP_COURSE, states, session: startStudySession(), now: NOW })).toEqual({
      kind: 'intro',
      itemKey: 'US',
    });
    const us = states.filter((s) => s.itemKey === 'US').map(introduce);
    expect(us.map((s) => s.phase)).toEqual(['review', 'review', 'learning']);
  });
});
