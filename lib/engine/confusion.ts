import { ENGINE_CONFIG } from './config';
import type { Confusion } from './types';

export function recordConfusion(
  list: readonly Confusion[],
  asked: string,
  answered: string,
): { confusions: Confusion[]; count: number } {
  const idx = list.findIndex((c) => c.asked === asked && c.answered === answered);
  if (idx === -1) return { confusions: [...list, { asked, answered, count: 1 }], count: 1 };
  const updated = { ...list[idx], count: list[idx].count + 1 };
  return { confusions: list.map((c, i) => (i === idx ? updated : c)), count: updated.count };
}

export function shouldInjectContrast(count: number): boolean {
  return count >= ENGINE_CONFIG.contrastThreshold;
}

/** Items confused with `itemKey` in either direction, most confused first. */
export function confusedWith(list: readonly Confusion[], itemKey: string): string[] {
  const totals = new Map<string, number>();
  for (const c of list) {
    const partner = c.asked === itemKey ? c.answered : c.answered === itemKey ? c.asked : null;
    if (partner) totals.set(partner, (totals.get(partner) ?? 0) + c.count);
  }
  return [...totals.entries()].sort((x, y) => y[1] - x[1]).map(([k]) => k);
}

export function topConfusions(
  list: readonly Confusion[],
  limit: number,
): { a: string; b: string; count: number }[] {
  const pairs = new Map<string, { a: string; b: string; count: number }>();
  for (const c of list) {
    const [a, b] = [c.asked, c.answered].sort();
    const key = `${a}|${b}`;
    const existing = pairs.get(key);
    pairs.set(key, { a, b, count: (existing?.count ?? 0) + c.count });
  }
  return [...pairs.values()].sort((x, y) => y.count - x.count).slice(0, limit);
}
