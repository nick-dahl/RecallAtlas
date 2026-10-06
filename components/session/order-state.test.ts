import { describe, expect, it } from 'vitest';
import { isComplete, pick, positionOf, startOrder, undo } from './order-state';

describe('order-state', () => {
  it('appends picks in order and reports 1-based positions', () => {
    const s = pick(pick(startOrder(4), 'b'), 'a');
    expect(s.picks).toEqual(['b', 'a']);
    expect(positionOf(s, 'b')).toBe(1);
    expect(positionOf(s, 'a')).toBe(2);
    expect(positionOf(s, 'c')).toBeNull();
  });

  it('ignores a card that is already placed (double tap)', () => {
    const s = pick(pick(startOrder(4), 'a'), 'a');
    expect(s.picks).toEqual(['a']);
  });

  it('is complete after every card is placed, and ignores further picks', () => {
    let s = startOrder(2);
    s = pick(s, 'a');
    expect(isComplete(s)).toBe(false);
    s = pick(s, 'b');
    expect(isComplete(s)).toBe(true);
    expect(pick(s, 'c')).toBe(s);
  });

  it('undoes the last pick, and does nothing when empty', () => {
    expect(undo(pick(pick(startOrder(3), 'a'), 'b')).picks).toEqual(['a']);
    const empty = startOrder(3);
    expect(undo(empty)).toBe(empty);
  });
});
