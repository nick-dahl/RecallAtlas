import type { Card } from 'ts-fsrs';
import type { Phase, PromptState, Rung } from '@/lib/engine';

export interface PromptStateRow {
  item_key: string;
  prompt_type: string;
  phase: Phase;
  rung: number;
  streak: number;
  fsrs: Record<string, unknown> | null;
}

/** jsonb turns a ts-fsrs Card's Dates into ISO strings; turn them back. */
export function reviveCard(json: Record<string, unknown> | null): Card | null {
  if (!json) return null;
  const card = { ...json, due: new Date(json.due as string) } as unknown as Card;
  if (json.last_review) card.last_review = new Date(json.last_review as string);
  else delete card.last_review;
  return card;
}

export function rowToPromptState(row: PromptStateRow): PromptState {
  return {
    itemKey: row.item_key,
    promptType: row.prompt_type,
    phase: row.phase,
    rung: row.rung as Rung,
    streak: row.streak,
    fsrs: reviveCard(row.fsrs),
  };
}
