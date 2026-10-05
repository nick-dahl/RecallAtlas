import type { ChoiceState } from '@/components/session/choice-state';
import type { FeedbackView } from '@/lib/study/types';

/** Matches the server's `point` validation (lib/study/validate.ts). */
export const MIN_MAP_WIDTH = 100;
export const MAX_MAP_WIDTH = 4000;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A click, normalized to [0,1] of the rendered map box, with the box's CSS width. */
export function normalizePoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number; width: number } {
  return {
    x: clamp((clientX - rect.left) / rect.width, 0, 1),
    y: clamp((clientY - rect.top) / rect.height, 0, 1),
    width: clamp(Math.round(rect.width), MIN_MAP_WIDTH, MAX_MAP_WIDTH),
  };
}

/** Keyboard crosshair steps, as a fraction of the map's width. */
export const CURSOR_STEP = 0.005;
export const CURSOR_STEP_COARSE = 0.05;

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * Moves the keyboard crosshair for an arrow key (Shift = coarse), or returns null for any other
 * key. `aspect` is the map's width / height, so a vertical step covers the same on-screen
 * distance as a horizontal one.
 */
export function moveCursor(
  cursor: { x: number; y: number },
  key: string,
  coarse: boolean,
  aspect: number,
): { x: number; y: number } | null {
  const dir = Object.hasOwn(ARROWS, key) ? ARROWS[key] : null;
  if (!dir) return null;
  const step = coarse ? CURSOR_STEP_COARSE : CURSOR_STEP;
  const round = (v: number) => Math.round(clamp(v, 0, 1) * 1e4) / 1e4;
  return { x: round(cursor.x + dir[0] * step), y: round(cursor.y + dir[1] * step * aspect) };
}

/**
 * After feedback on a map-pick: candidates carry no keys, so the right one is the candidate
 * whose outline is the feedback's correct outline.
 */
export function candidateState(d: string, id: string, feedback: FeedbackView | null, chosenId: string | null): ChoiceState {
  if (!feedback?.map) return 'idle';
  if (d === feedback.map.correct) return 'correct';
  return id === chosenId ? 'wrong' : 'dim';
}
