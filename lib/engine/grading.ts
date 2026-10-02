import { ENGINE_CONFIG } from './config';
import type { AnswerGrade, Item } from './types';

export function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['‘’ʼ´`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the /, '')
    .replace(/\bst\b/g, 'saint');
}

/** Optimal string alignment distance: Levenshtein plus adjacent transposition as a single edit. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) d[i][0] = i;
  for (let j = 0; j < cols; j++) d[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[rows - 1][cols - 1];
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
    const d = editDistance(input, name);
    if (d <= tolerance(name) && (best === null || d < best)) best = d;
  }
  return best;
}

function wrong(answeredItemKey: string | null = null): AnswerGrade {
  return { correct: false, typo: false, answeredItemKey };
}

export function gradeTyped(input: string, target: Item, allItems: readonly Item[]): AnswerGrade {
  const n = normalize(input);
  if (!n) return wrong();
  if (namesOf(target).includes(n)) return { correct: true, typo: false, answeredItemKey: null };

  const others = allItems.filter((i) => i.key !== target.key);
  const exactOther = others.find((i) => namesOf(i).includes(n));
  if (exactOther) return wrong(exactOther.key);

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
  if (closestOther) return wrong(closestOther.key);
  return wrong();
}

export function gradeChoice(choiceKey: string | null, targetKey: string): AnswerGrade {
  if (choiceKey === null) return wrong();
  if (choiceKey === targetKey) return { correct: true, typo: false, answeredItemKey: null };
  return wrong(choiceKey);
}
