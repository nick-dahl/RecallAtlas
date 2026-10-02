import { describe, expect, it } from 'vitest';
import { introduce } from './ladder';
import { applyPlacementAnswer, buildPlacementQueue } from './placement';
import { advance, currentEntry, isQueueComplete } from './queue';
import { initialStates } from './state';
import { NOW, TEST_COURSE } from './test-fixtures';

describe('buildPlacementQueue', () => {
  it('asks every all-new item once, typed flag_to_name, in group order', () => {
    const q = buildPlacementQueue(TEST_COURSE, initialStates(TEST_COURSE));
    expect(q.queue).toHaveLength(TEST_COURSE.items.length);
    expect(q.queue[0]).toEqual({ kind: 'prompt', itemKey: 'US', promptType: 'flag_to_name' });
    expect(q.queue.slice(1, 5).map((e) => e.itemKey)).toEqual(['EC', 'CO', 'VE', 'PE']);
  });

  it('skips items already started', () => {
    const states = initialStates(TEST_COURSE).map((s) => (s.itemKey === 'US' ? introduce(s) : s));
    const q = buildPlacementQueue(TEST_COURSE, states);
    expect(q.queue.map((e) => e.itemKey)).not.toContain('US');
  });
});

describe('queue helpers', () => {
  it('walks the queue to completion', () => {
    let q = buildPlacementQueue(TEST_COURSE, initialStates(TEST_COURSE));
    expect(currentEntry(q)?.itemKey).toBe('US');
    for (let i = 0; i < TEST_COURSE.items.length; i++) q = advance(q);
    expect(isQueueComplete(q)).toBe(true);
    expect(currentEntry(q)).toBeNull();
  });
});

describe('applyPlacementAnswer', () => {
  it('graduates both prompts of a correctly named item', () => {
    const states = applyPlacementAnswer({ states: initialStates(TEST_COURSE), itemKey: 'US', correct: true, now: NOW });
    const us = states.filter((s) => s.itemKey === 'US');
    expect(us).toHaveLength(2);
    expect(us.every((s) => s.phase === 'review' && s.fsrs !== null)).toBe(true);
    expect(states.filter((s) => s.itemKey !== 'US').every((s) => s.phase === 'new')).toBe(true);
  });

  it('leaves the item new when missed', () => {
    const before = initialStates(TEST_COURSE);
    const after = applyPlacementAnswer({ states: before, itemKey: 'EC', correct: false, now: NOW });
    expect(after).toEqual(before);
  });
});
