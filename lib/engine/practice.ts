import { ENGINE_CONFIG } from './config';
import { retrievability } from './scheduler';
import type { PromptEntry, PromptState, Rng } from './types';

/** Picks one entry at random, in proportion to its weight. */
function weightedPick<T>(list: readonly T[], weight: (t: T) => number, rng: Rng): T {
  const total = list.reduce((sum, t) => sum + weight(t), 0);
  let r = rng() * total;
  for (const t of list) {
    r -= weight(t);
    if (r < 0) return t;
  }
  return list[list.length - 1];
}

/**
 * Plans a practice-ahead retention check: up to `size` learned items, one prompt each, drawn at
 * random but weighted towards what is most likely forgotten. The weight floor keeps recently
 * learned items in the mix, so a check covers both fading and fresh material.
 */
export function planPractice(states: readonly PromptState[], now: Date, size: number, rng: Rng): PromptEntry[] {
  const weight = (s: PromptState) => 1 - retrievability(s, now) + ENGINE_CONFIG.practiceWeightFloor;
  const byItem = new Map<string, PromptState[]>();
  for (const s of states) {
    if (s.phase === 'review') byItem.set(s.itemKey, [...(byItem.get(s.itemKey) ?? []), s]);
  }
  // Weighted sampling without replacement (Efraimidis–Spirakis): highest u^(1/w) wins.
  return [...byItem.values()]
    .map((prompts) => {
      const chosen = weightedPick(prompts, weight, rng);
      return { chosen, key: rng() ** (1 / weight(chosen)) };
    })
    .sort((a, b) => b.key - a.key)
    .slice(0, size)
    .map(({ chosen }) => ({ kind: 'prompt' as const, itemKey: chosen.itemKey, promptType: chosen.promptType }));
}
