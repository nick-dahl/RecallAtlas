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

/**
 * After feedback on a map-pick: candidates carry no keys, so the right one is the candidate
 * whose outline is the feedback's correct outline.
 */
export function candidateState(d: string, id: string, feedback: FeedbackView | null, chosenId: string | null): ChoiceState {
  if (!feedback?.map) return 'idle';
  if (d === feedback.map.correct) return 'correct';
  return id === chosenId ? 'wrong' : 'dim';
}
