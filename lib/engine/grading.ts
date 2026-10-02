import { ENGINE_CONFIG } from './config';
import type { AnswerGrade, Item } from './types';

export function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the /, '')
    .replace(/\bst\b/g, 'saint');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

function tolerance(normalizedName: string): number {
  return normalizedName.length < ENGINE_CONFIG.typoLongMinLength
    ? ENGINE_CONFIG.typoShortMax
    : ENGINE_CONFIG.typoLongMax;
}

function namesOf(item: Item): string[] {
  return [item.name, ...item.aliases].map(normalize).filter(Boolean);
}

/** Smallest edit distance to any of the item's names that is within tolerance, else null. */
function typoDistance(input: string, item: Item): number | null {
  let best: number | null = null;
  for (const name of namesOf(item)) {
    const d = levenshtein(input, name);
    if (d <= tolerance(name) && (best === null || d < best)) best = d;
  }
  return best;
}

const WRONG: AnswerGrade = { correct: false, typo: false, answeredItemKey: null };

export function gradeTyped(input: string, target: Item, allItems: readonly Item[]): AnswerGrade {
  const n = normalize(input);
  if (!n) return WRONG;
  if (namesOf(target).includes(n)) return { correct: true, typo: false, answeredItemKey: null };

  const others = allItems.filter((i) => i.key !== target.key);
  const exactOther = others.find((i) => namesOf(i).includes(n));
  if (exactOther) return { ...WRONG, answeredItemKey: exactOther.key };

  const targetDistance = typoDistance(n, target);
  let closestOther: { key: string; d: number } | null = null;
  for (const other of others) {
    const d = typoDistance(n, other);
    if (d !== null && (closestOther === null || d < closestOther.d)) closestOther = { key: other.key, d };
  }

  // Another item within tolerance wins ties (spec §6.9).
  if (targetDistance !== null && (closestOther === null || targetDistance < closestOther.d)) {
    return { correct: true, typo: true, answeredItemKey: null };
  }
  if (closestOther) return { ...WRONG, answeredItemKey: closestOther.key };
  return WRONG;
}

export function gradeChoice(choiceKey: string | null, targetKey: string): AnswerGrade {
  if (choiceKey === null) return WRONG;
  if (choiceKey === targetKey) return { correct: true, typo: false, answeredItemKey: null };
  return { ...WRONG, answeredItemKey: choiceKey };
}
