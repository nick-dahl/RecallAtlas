import { describe, expect, it } from 'vitest';
import { graduate, isDue, newPromptState, type PromptState } from '@/lib/engine';
import { NOW } from '@/lib/engine/test-fixtures';
import { reviveCard, rowToPromptState, type PromptStateRow } from './serialize';

const learningRung3: PromptState = { ...newPromptState('EC', 'flag_to_name'), phase: 'learning', rung: 3 };

/** What Postgres jsonb hands back: Dates become ISO strings. */
function viaJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function toRow(state: PromptState): PromptStateRow {
  const json = viaJson(state);
  return {
    item_key: json.itemKey,
    prompt_type: json.promptType,
    phase: json.phase,
    rung: json.rung,
    streak: json.streak,
    fsrs: json.fsrs as unknown as Record<string, unknown> | null,
  };
}

describe('rowToPromptState', () => {
  it('round-trips a graduated prompt, reviving FSRS dates so isDue works', () => {
    const graduated = graduate(learningRung3, NOW);
    const revived = rowToPromptState(toRow(graduated));
    expect(revived).toEqual(graduated);
    expect(revived.fsrs!.due).toBeInstanceOf(Date);
    expect(isDue(revived, graduated.fsrs!.due)).toBe(true);
    expect(isDue(revived, NOW)).toBe(false);
  });

  it('keeps a null FSRS card null', () => {
    const fresh = newPromptState('EC', 'name_to_flag');
    expect(rowToPromptState(toRow(fresh))).toEqual(fresh);
  });
});

describe('reviveCard', () => {
  it('handles a missing last_review', () => {
    const card = reviveCard({ due: NOW.toISOString(), stability: 1, difficulty: 5, reps: 0, lapses: 0, state: 0 });
    expect(card!.due).toEqual(NOW);
    expect(card!.last_review).toBeUndefined();
  });
});
