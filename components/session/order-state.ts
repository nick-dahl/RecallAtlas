/** Put-in-order picks: the cards placed so far, in order, out of `total`. */
export interface OrderState {
  picks: string[];
  total: number;
}

export const startOrder = (total: number): OrderState => ({ picks: [], total });

export const isComplete = (state: OrderState): boolean => state.picks.length === state.total;

/** Places a card next. A card already placed, or any pick once complete, changes nothing. */
export function pick(state: OrderState, id: string): OrderState {
  if (isComplete(state) || state.picks.includes(id)) return state;
  return { ...state, picks: [...state.picks, id] };
}

/** Removes the last placed card (Backspace). */
export function undo(state: OrderState): OrderState {
  if (state.picks.length === 0) return state;
  return { ...state, picks: state.picks.slice(0, -1) };
}

/** 1-based position of a card, or null when not yet placed. */
export function positionOf(state: OrderState, id: string): number | null {
  const i = state.picks.indexOf(id);
  return i === -1 ? null : i + 1;
}

/** A tap: places an unplaced card, or takes back the last-placed one (touch screens have no Backspace). */
export function toggle(state: OrderState, id: string): OrderState {
  if (isComplete(state)) return state;
  if (state.picks[state.picks.length - 1] === id) return undo(state);
  return pick(state, id);
}
