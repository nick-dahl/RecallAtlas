import type { Phase, TileState } from '@/lib/engine';

/**
 * Mastery map fills: countries ink in as they are learned (learning shades deepen with the
 * rung), learned ones turn green, mastered ones also get a gold outline.
 */
export const MASTERY_STYLE: Record<TileState, { fill: string; label: string; gold?: boolean }> = {
  new: { fill: 'var(--paper-raised)', label: 'Not started' },
  'learning-1': { fill: 'color-mix(in oklab, var(--learning) 30%, var(--paper-raised))', label: 'Learning' },
  'learning-2': { fill: 'color-mix(in oklab, var(--learning) 50%, var(--paper-raised))', label: 'Learning' },
  'learning-3': { fill: 'color-mix(in oklab, var(--learning) 70%, var(--paper-raised))', label: 'Almost there' },
  review: { fill: 'color-mix(in oklab, var(--good) 65%, var(--paper-raised))', label: 'Learned' },
  strong: { fill: 'var(--good)', label: 'Mastered', gold: true },
};

/** The legend, one entry per distinct label, in learning order. */
export const MASTERY_LEGEND: { tile: TileState; label: string }[] = (
  ['new', 'learning-2', 'review', 'strong'] as const
).map((tile) => ({ tile, label: tile === 'learning-2' ? 'Learning' : MASTERY_STYLE[tile].label }));

const PHASE_WORD: Record<Phase, string> = { new: 'not started', learning: 'learning', review: 'learned' };

/** Hover summary, e.g. "Bolivia: Find it learned, Name it learning". */
export function masterySummary(name: string, prompts: readonly { label: string; phase: Phase }[]): string {
  return `${name}: ${prompts.map((p) => `${p.label} ${PHASE_WORD[p.phase]}`).join(', ')}`;
}
