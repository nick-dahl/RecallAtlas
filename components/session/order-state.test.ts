import { describe, expect, it } from 'vitest';
import { isComplete, pick, positionOf, startOrder, toggle, undo } from './order-state';

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

describe('toggle (tap to place, tap the last-placed card to take it back)', () => {
  it('places an unplaced card', () => {
    expect(toggle(startOrder(4), 'a').picks).toEqual(['a']);
  });

  it('takes back the last-placed card, so a touch screen can undo a mis-tap', () => {
    const s = toggle(toggle(startOrder(4), 'a'), 'b');
    expect(toggle(s, 'b').picks).toEqual(['a']);
  });

  it('ignores earlier placed cards and anything once complete', () => {
    const s = toggle(toggle(startOrder(4), 'a'), 'b');
    expect(toggle(s, 'a')).toBe(s);
    const done = toggle(toggle(startOrder(2), 'a'), 'b');
    expect(toggle(done, 'b')).toBe(done);
  });
});
